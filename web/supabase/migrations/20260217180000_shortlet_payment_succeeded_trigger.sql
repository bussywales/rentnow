-- Safety net: when shortlet payment is marked succeeded, transition booking out of pending_payment.

create or replace function public.shortlet_apply_payment_succeeded_transition()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  booking_current_status text;
  booking_mode text;
  next_status text;
begin
  if new.status <> 'succeeded' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'succeeded' then
    return new;
  end if;

  select b.status,
         coalesce(b.pricing_snapshot_json ->> 'booking_mode', 'request')
    into booking_current_status, booking_mode
  from public.shortlet_bookings b
  where b.id = new.booking_id
  for update;

  if not found then
    return new;
  end if;

  if booking_current_status <> 'pending_payment' then
    return new;
  end if;

  next_status := case
    when booking_mode = 'instant' then 'confirmed'
    else 'pending'
  end;

  update public.shortlet_bookings
  set status = next_status,
      payment_reference = coalesce(payment_reference, new.provider_reference),
      expires_at = case
        when next_status = 'pending'
          then coalesce(expires_at, now() + interval '24 hours')
        else null
      end,
      refund_required = false,
      updated_at = now()
  where id = new.booking_id
    and status = 'pending_payment';

  return new;
end;
$$;

drop trigger if exists shortlet_payments_apply_payment_succeeded_transition on public.shortlet_payments;

create trigger shortlet_payments_apply_payment_succeeded_transition
after insert or update of status on public.shortlet_payments
for each row
when (new.status = 'succeeded')
execute function public.shortlet_apply_payment_succeeded_transition();
