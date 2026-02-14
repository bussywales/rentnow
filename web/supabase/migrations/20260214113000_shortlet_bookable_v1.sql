-- W8.0 Shortlet bookable MVP (manual payouts) + listing intent expansion.

alter table public.properties
  alter column listing_intent set default 'rent_lease';

alter table public.properties
  drop constraint if exists properties_listing_intent_check;

update public.properties
set listing_intent = 'rent_lease'
where listing_intent = 'rent';

update public.properties
set listing_intent = 'sale'
where listing_intent = 'buy';

alter table public.properties
  add constraint properties_listing_intent_check
  check (listing_intent in ('rent_lease', 'sale', 'shortlet', 'off_plan'));

create table if not exists public.shortlet_settings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  booking_mode text not null default 'request',
  nightly_price_minor integer,
  cleaning_fee_minor integer not null default 0,
  deposit_minor integer not null default 0,
  min_nights integer not null default 1,
  max_nights integer,
  advance_notice_hours integer not null default 0,
  prep_days integer not null default 0,
  checkin_time time,
  checkout_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_settings_booking_mode_chk check (booking_mode in ('instant', 'request')),
  constraint shortlet_settings_nightly_price_chk check (nightly_price_minor is null or nightly_price_minor >= 0),
  constraint shortlet_settings_cleaning_fee_chk check (cleaning_fee_minor >= 0),
  constraint shortlet_settings_deposit_chk check (deposit_minor >= 0),
  constraint shortlet_settings_min_nights_chk check (min_nights >= 1),
  constraint shortlet_settings_max_nights_chk check (max_nights is null or max_nights >= min_nights),
  constraint shortlet_settings_advance_notice_chk check (advance_notice_hours >= 0),
  constraint shortlet_settings_prep_days_chk check (prep_days >= 0)
);

create table if not exists public.shortlet_bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_user_id uuid not null references public.profiles(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  nights integer not null,
  status text not null default 'pending',
  total_amount_minor integer not null,
  currency text not null,
  pricing_snapshot_json jsonb not null default '{}'::jsonb,
  payment_reference text,
  expires_at timestamptz,
  refund_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_bookings_status_chk check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'expired', 'completed')),
  constraint shortlet_bookings_nights_chk check (nights >= 1),
  constraint shortlet_bookings_total_chk check (total_amount_minor >= 0),
  constraint shortlet_bookings_dates_chk check (check_out > check_in)
);

create index if not exists shortlet_bookings_property_dates_idx
  on public.shortlet_bookings (property_id, check_in, check_out);

create index if not exists shortlet_bookings_guest_created_idx
  on public.shortlet_bookings (guest_user_id, created_at desc);

create index if not exists shortlet_bookings_host_created_idx
  on public.shortlet_bookings (host_user_id, created_at desc);

create index if not exists shortlet_bookings_status_idx
  on public.shortlet_bookings (status, created_at desc);

create index if not exists shortlet_bookings_expires_idx
  on public.shortlet_bookings (expires_at)
  where status = 'pending';

create table if not exists public.shortlet_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_blocks_dates_chk check (date_to > date_from)
);

create index if not exists shortlet_blocks_property_dates_idx
  on public.shortlet_blocks (property_id, date_from, date_to);

create table if not exists public.shortlet_payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  amount_minor integer not null,
  currency text not null,
  status text not null default 'eligible',
  paid_at timestamptz,
  paid_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_payouts_status_chk check (status in ('eligible', 'paid')),
  constraint shortlet_payouts_amount_chk check (amount_minor >= 0)
);

create unique index if not exists shortlet_payouts_booking_unique
  on public.shortlet_payouts (booking_id);

create index if not exists shortlet_payouts_status_idx
  on public.shortlet_payouts (status, created_at desc);

create or replace function public.touch_shortlet_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shortlet_settings_touch_updated_at on public.shortlet_settings;
create trigger shortlet_settings_touch_updated_at
before update on public.shortlet_settings
for each row execute function public.touch_shortlet_updated_at();

drop trigger if exists shortlet_bookings_touch_updated_at on public.shortlet_bookings;
create trigger shortlet_bookings_touch_updated_at
before update on public.shortlet_bookings
for each row execute function public.touch_shortlet_updated_at();

drop trigger if exists shortlet_blocks_touch_updated_at on public.shortlet_blocks;
create trigger shortlet_blocks_touch_updated_at
before update on public.shortlet_blocks
for each row execute function public.touch_shortlet_updated_at();

drop trigger if exists shortlet_payouts_touch_updated_at on public.shortlet_payouts;
create trigger shortlet_payouts_touch_updated_at
before update on public.shortlet_payouts
for each row execute function public.touch_shortlet_updated_at();

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
    settings_row.property_id := p_property_id;
    settings_row.booking_mode := 'request';
    settings_row.nightly_price_minor := null;
    settings_row.cleaning_fee_minor := 0;
    settings_row.deposit_minor := 0;
    settings_row.min_nights := 1;
    settings_row.max_nights := null;
    settings_row.advance_notice_hours := 0;
    settings_row.prep_days := 0;
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

  nightly_minor := coalesce(settings_row.nightly_price_minor, greatest(0, round(coalesce(property_row.price, 0)::numeric * 100)::integer));
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
      'booking_mode', resolved_mode
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

create or replace function public.respond_shortlet_booking(
  p_booking_id uuid,
  p_host_user_id uuid,
  p_action text
)
returns table (
  booking_id uuid,
  booking_status text,
  host_user_id uuid,
  guest_user_id uuid,
  property_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  booking_row public.shortlet_bookings%rowtype;
  next_status text;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;

  select * into booking_row
  from public.shortlet_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if booking_row.host_user_id <> p_host_user_id then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if booking_row.status <> 'pending' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  next_status := case when p_action = 'accept' then 'confirmed' else 'declined' end;

  update public.shortlet_bookings
  set status = next_status,
      expires_at = null,
      refund_required = case when next_status = 'declined' then true else refund_required end,
      updated_at = now()
  where id = booking_row.id
  returning * into booking_row;

  return query
  select booking_row.id, booking_row.status, booking_row.host_user_id, booking_row.guest_user_id, booking_row.property_id;
end;
$$;

revoke all on function public.respond_shortlet_booking(uuid, uuid, text) from public;
grant execute on function public.respond_shortlet_booking(uuid, uuid, text) to authenticated;
grant execute on function public.respond_shortlet_booking(uuid, uuid, text) to service_role;

alter table public.shortlet_settings enable row level security;
alter table public.shortlet_settings force row level security;

alter table public.shortlet_bookings enable row level security;
alter table public.shortlet_bookings force row level security;

alter table public.shortlet_blocks enable row level security;
alter table public.shortlet_blocks force row level security;

alter table public.shortlet_payouts enable row level security;
alter table public.shortlet_payouts force row level security;

drop policy if exists "shortlet settings public read" on public.shortlet_settings;
create policy "shortlet settings public read"
  on public.shortlet_settings
  for select
  using (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_settings.property_id
        and p.is_approved = true
        and p.is_active = true
        and p.status = 'live'
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet settings owner manage" on public.shortlet_settings;
create policy "shortlet settings owner manage"
  on public.shortlet_settings
  for all
  using (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_settings.property_id
        and p.owner_id = auth.uid()
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_settings.property_id
        and p.owner_id = auth.uid()
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet blocks public read" on public.shortlet_blocks;
create policy "shortlet blocks public read"
  on public.shortlet_blocks
  for select
  using (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_blocks.property_id
        and p.is_approved = true
        and p.is_active = true
        and p.status = 'live'
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet blocks owner manage" on public.shortlet_blocks;
create policy "shortlet blocks owner manage"
  on public.shortlet_blocks
  for all
  using (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_blocks.property_id
        and p.owner_id = auth.uid()
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = shortlet_blocks.property_id
        and p.owner_id = auth.uid()
    )
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet bookings guest read" on public.shortlet_bookings;
create policy "shortlet bookings guest read"
  on public.shortlet_bookings
  for select
  using (
    guest_user_id = auth.uid()
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
    or exists (
      select 1
      from public.properties p
      where p.id = shortlet_bookings.property_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "shortlet bookings service write" on public.shortlet_bookings;
create policy "shortlet bookings service write"
  on public.shortlet_bookings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "shortlet payouts host read" on public.shortlet_payouts;
create policy "shortlet payouts host read"
  on public.shortlet_payouts
  for select
  using (
    host_user_id = auth.uid()
    or auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet payouts admin write" on public.shortlet_payouts;
create policy "shortlet payouts admin write"
  on public.shortlet_payouts
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );
