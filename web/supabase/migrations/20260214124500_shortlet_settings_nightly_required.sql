-- Enforce shortlet pricing from shortlet_settings only.

alter table public.shortlet_settings
  drop constraint if exists shortlet_settings_nightly_price_chk;

alter table public.shortlet_settings
  add constraint shortlet_settings_nightly_price_chk
  check (nightly_price_minor is not null and nightly_price_minor > 0)
  not valid;

create or replace function public.create_shortlet_booking(
  p_property_id uuid,
  p_guest_user_id uuid,
  p_check_in date,
  p_check_out date
)
returns table (
  booking_id uuid,
  booking_status text,
  nights integer,
  total_amount_minor integer,
  currency text,
  expires_at timestamptz,
  pricing_snapshot_json jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  property_row public.properties%rowtype;
  settings_row public.shortlet_settings%rowtype;
  now_ts timestamptz := now();
  calc_nights integer;
  nightly_minor integer;
  cleaning_minor integer;
  deposit_minor integer;
  subtotal_minor integer;
  total_minor integer;
  resolved_mode text;
  resolved_expiry timestamptz;
  overlap_exists boolean;
  created_booking public.shortlet_bookings%rowtype;
begin
  if p_guest_user_id is null then
    raise exception 'GUEST_REQUIRED' using errcode = '22023';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'INVALID_DATES' using errcode = '22023';
  end if;

  calc_nights := (p_check_out - p_check_in);
  if calc_nights < 1 then
    raise exception 'INVALID_NIGHTS' using errcode = '22023';
  end if;

  select * into property_row
  from public.properties
  where id = p_property_id
  for update;

  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if property_row.listing_intent <> 'shortlet' then
    raise exception 'NOT_SHORTLET' using errcode = 'P0001';
  end if;

  if property_row.owner_id = p_guest_user_id then
    raise exception 'SELF_BOOKING_BLOCKED' using errcode = 'P0001';
  end if;

  select * into settings_row
  from public.shortlet_settings
  where property_id = p_property_id
  for update;

  if settings_row.property_id is null then
    raise exception 'SHORTLET_SETTINGS_REQUIRED' using errcode = 'P0001';
  end if;

  if settings_row.nightly_price_minor is null or settings_row.nightly_price_minor <= 0 then
    raise exception 'NIGHTLY_PRICE_REQUIRED' using errcode = 'P0001';
  end if;

  if calc_nights < coalesce(settings_row.min_nights, 1) then
    raise exception 'MIN_NIGHTS_NOT_MET' using errcode = 'P0001';
  end if;

  if settings_row.max_nights is not null and calc_nights > settings_row.max_nights then
    raise exception 'MAX_NIGHTS_EXCEEDED' using errcode = 'P0001';
  end if;

  if settings_row.advance_notice_hours is not null and settings_row.advance_notice_hours > 0 then
    if p_check_in::timestamp < (now_ts + make_interval(hours => settings_row.advance_notice_hours)) then
      raise exception 'ADVANCE_NOTICE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  select exists (
    select 1
    from public.shortlet_bookings b
    where b.property_id = p_property_id
      and b.status in ('pending', 'confirmed', 'completed')
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) into overlap_exists;

  if overlap_exists then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.shortlet_blocks blk
    where blk.property_id = p_property_id
      and daterange(blk.date_from, blk.date_to, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) into overlap_exists;

  if overlap_exists then
    raise exception 'DATES_BLOCKED' using errcode = 'P0001';
  end if;

  nightly_minor := settings_row.nightly_price_minor;
  cleaning_minor := greatest(0, coalesce(settings_row.cleaning_fee_minor, 0));
  deposit_minor := greatest(0, coalesce(settings_row.deposit_minor, 0));
  subtotal_minor := nightly_minor * calc_nights;
  total_minor := subtotal_minor + cleaning_minor + deposit_minor;

  resolved_mode := coalesce(settings_row.booking_mode, 'request');
  resolved_expiry := case when resolved_mode = 'request' then now_ts + interval '24 hours' else null end;

  insert into public.shortlet_bookings (
    property_id,
    guest_user_id,
    host_user_id,
    check_in,
    check_out,
    nights,
    status,
    total_amount_minor,
    currency,
    pricing_snapshot_json,
    expires_at,
    payment_reference
  )
  values (
    p_property_id,
    p_guest_user_id,
    property_row.owner_id,
    p_check_in,
    p_check_out,
    calc_nights,
    case when resolved_mode = 'instant' then 'confirmed' else 'pending' end,
    total_minor,
    coalesce(property_row.currency, 'NGN'),
    jsonb_build_object(
      'nightly_price_minor', nightly_minor,
      'nights', calc_nights,
      'subtotal_minor', subtotal_minor,
      'cleaning_fee_minor', cleaning_minor,
      'deposit_minor', deposit_minor,
      'total_amount_minor', total_minor,
      'currency', coalesce(property_row.currency, 'NGN'),
      'booking_mode', resolved_mode,
      'pricing_source', 'shortlet_settings'
    ),
    resolved_expiry,
    null
  )
  returning * into created_booking;

  return query
  select
    created_booking.id,
    created_booking.status,
    created_booking.nights,
    created_booking.total_amount_minor,
    created_booking.currency,
    created_booking.expires_at,
    created_booking.pricing_snapshot_json;
end;
$$;

revoke all on function public.create_shortlet_booking(uuid, uuid, date, date) from public;
grant execute on function public.create_shortlet_booking(uuid, uuid, date, date) to authenticated;
grant execute on function public.create_shortlet_booking(uuid, uuid, date, date) to service_role;
