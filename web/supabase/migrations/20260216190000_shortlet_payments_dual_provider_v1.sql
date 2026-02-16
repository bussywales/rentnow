-- Shortlet payments v1: dual-provider checkout (Stripe + Paystack) with idempotent webhook handling.

insert into public.app_settings (key, value)
values
  ('shortlet_payments_stripe_enabled', '{"enabled": true}'::jsonb),
  ('shortlet_payments_paystack_enabled', '{"enabled": true}'::jsonb),
  ('shortlet_auto_payouts_enabled', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

alter table public.shortlet_bookings
  drop constraint if exists shortlet_bookings_status_chk;

alter table public.shortlet_bookings
  add constraint shortlet_bookings_status_chk
  check (status in ('pending_payment', 'pending', 'confirmed', 'declined', 'cancelled', 'expired', 'completed'));

alter table public.shortlet_bookings
  drop constraint if exists shortlet_bookings_no_overlap;

alter table public.shortlet_bookings
  add constraint shortlet_bookings_no_overlap
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

create table if not exists public.shortlet_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_user_id uuid not null references public.profiles(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paystack',
  currency text not null default 'NGN',
  amount_total_minor bigint not null,
  status text not null default 'initiated',
  provider_reference text not null,
  provider_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.shortlet_payments
  add column if not exists property_id uuid references public.properties(id) on delete cascade,
  add column if not exists guest_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists host_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists amount_total_minor bigint,
  add column if not exists provider_reference text,
  add column if not exists provider_payload_json jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shortlet_payments'
      and column_name = 'amount_minor'
  ) then
    execute 'update public.shortlet_payments
      set amount_total_minor = coalesce(amount_total_minor, amount_minor)
      where amount_total_minor is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shortlet_payments'
      and column_name = 'reference'
  ) then
    execute 'update public.shortlet_payments
      set provider_reference = coalesce(provider_reference, reference)
      where provider_reference is null';
  end if;
end;
$$;

update public.shortlet_payments sp
set
  property_id = coalesce(sp.property_id, b.property_id),
  guest_user_id = coalesce(sp.guest_user_id, b.guest_user_id),
  host_user_id = coalesce(sp.host_user_id, b.host_user_id),
  amount_total_minor = coalesce(sp.amount_total_minor, b.total_amount_minor)
from public.shortlet_bookings b
where b.id = sp.booking_id;

alter table public.shortlet_payments
  alter column property_id set not null,
  alter column guest_user_id set not null,
  alter column host_user_id set not null,
  alter column amount_total_minor set not null,
  alter column provider_reference set not null;

alter table public.shortlet_payments
  alter column provider set default 'paystack',
  alter column status set default 'initiated',
  alter column currency set default 'NGN';

alter table public.shortlet_payments
  drop constraint if exists shortlet_payments_provider_chk,
  drop constraint if exists shortlet_payments_status_chk,
  drop constraint if exists shortlet_payments_amount_chk,
  drop constraint if exists shortlet_payments_currency_chk,
  drop constraint if exists shortlet_payments_reference_unique;

alter table public.shortlet_payments
  add constraint shortlet_payments_provider_chk
    check (provider in ('stripe', 'paystack')),
  add constraint shortlet_payments_status_chk
    check (status in ('initiated', 'succeeded', 'failed', 'refunded')),
  add constraint shortlet_payments_amount_chk
    check (amount_total_minor > 0),
  add constraint shortlet_payments_currency_chk
    check (char_length(currency) = 3);

create unique index if not exists shortlet_payments_booking_unique
  on public.shortlet_payments (booking_id);

create unique index if not exists shortlet_payments_provider_reference_uidx
  on public.shortlet_payments (provider, provider_reference);

create unique index if not exists shortlet_payments_booking_succeeded_uidx
  on public.shortlet_payments (booking_id)
  where status = 'succeeded';

create index if not exists shortlet_payments_status_created_idx
  on public.shortlet_payments (status, created_at desc);

create index if not exists shortlet_payments_guest_created_idx
  on public.shortlet_payments (guest_user_id, created_at desc);

create index if not exists shortlet_payments_host_created_idx
  on public.shortlet_payments (host_user_id, created_at desc);

drop trigger if exists shortlet_payments_touch_updated_at on public.shortlet_payments;
create trigger shortlet_payments_touch_updated_at
before update on public.shortlet_payments
for each row execute function public.touch_shortlet_updated_at();

alter table public.shortlet_payments enable row level security;
alter table public.shortlet_payments force row level security;

drop policy if exists "shortlet payments read own" on public.shortlet_payments;
create policy "shortlet payments read own"
  on public.shortlet_payments
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or guest_user_id = auth.uid()
    or host_user_id = auth.uid()
  );

drop policy if exists "shortlet payments service write" on public.shortlet_payments;
create policy "shortlet payments service write"
  on public.shortlet_payments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.payment_webhook_events
  drop constraint if exists payment_webhook_events_provider_chk;

alter table public.payment_webhook_events
  add constraint payment_webhook_events_provider_chk
  check (provider in ('paystack', 'stripe'));

alter table public.payment_webhook_events
  add column if not exists event_id text;

create unique index if not exists payment_webhook_events_provider_event_id_uidx
  on public.payment_webhook_events (provider, event_id)
  where event_id is not null;
