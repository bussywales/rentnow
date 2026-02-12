-- Payments v1 foundation: Paystack featured purchases + activation bridge

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null,
  currency text not null,
  amount_minor integer not null,
  email text null,
  reference text not null unique,
  authorization_code text null,
  paid_at timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_chk check (provider in ('paystack')),
  constraint payments_status_chk check (status in ('initialized', 'pending', 'succeeded', 'failed', 'cancelled')),
  constraint payments_amount_minor_chk check (amount_minor >= 0)
);

create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

create index if not exists payments_status_idx
  on public.payments (status);

create table if not exists public.featured_purchases (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid null references public.featured_requests(id) on delete set null,
  plan text not null,
  duration_days integer not null,
  status text not null,
  featured_until timestamptz null,
  activated_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint featured_purchases_plan_chk check (plan in ('featured_7d', 'featured_30d')),
  constraint featured_purchases_duration_chk check (duration_days in (7, 30)),
  constraint featured_purchases_status_chk check (status in ('pending', 'activated', 'void'))
);

create unique index if not exists featured_purchases_payment_unique
  on public.featured_purchases (payment_id);

create index if not exists featured_purchases_property_created_idx
  on public.featured_purchases (property_id, created_at desc);

create or replace function public.touch_payments_updated_at()
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

drop trigger if exists payments_touch_updated_at on public.payments;
create trigger payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_payments_updated_at();

create or replace function public.activate_featured_purchase(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  payment_row public.payments%rowtype;
  purchase_row public.featured_purchases%rowtype;
  now_ts timestamptz := now();
  effective_until timestamptz;
begin
  select * into payment_row
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    return;
  end if;

  if payment_row.status <> 'succeeded' then
    raise exception 'PAYMENT_NOT_SUCCEEDED' using errcode = 'P0001';
  end if;

  for purchase_row in
    select *
    from public.featured_purchases
    where payment_id = p_payment_id
      and status = 'pending'
    for update
  loop
    if exists (
      select 1
      from public.properties p
      where p.id = purchase_row.property_id
        and p.is_demo is true
    ) then
      raise exception 'DEMO_PROPERTY_BLOCKED' using errcode = 'P0001';
    end if;

    effective_until := now_ts + make_interval(days => purchase_row.duration_days);

    update public.properties
    set is_featured = true,
        featured_until = effective_until,
        featured_at = coalesce(featured_at, now_ts),
        featured_by = payment_row.user_id,
        updated_at = now_ts
    where id = purchase_row.property_id;

    update public.featured_purchases
    set status = 'activated',
        featured_until = effective_until,
        activated_at = now_ts
    where id = purchase_row.id
      and status = 'pending';
  end loop;
end;
$$;

revoke all on function public.activate_featured_purchase(uuid) from public;
grant execute on function public.activate_featured_purchase(uuid) to service_role;

alter table public.payments enable row level security;
alter table public.payments force row level security;

drop policy if exists "payments owner select" on public.payments;
create policy "payments owner select"
  on public.payments
  for select
  using (auth.uid() = user_id);

drop policy if exists "payments admin select" on public.payments;
create policy "payments admin select"
  on public.payments
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "payments service all" on public.payments;
create policy "payments service all"
  on public.payments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.featured_purchases enable row level security;
alter table public.featured_purchases force row level security;

drop policy if exists "featured purchases owner select" on public.featured_purchases;
create policy "featured purchases owner select"
  on public.featured_purchases
  for select
  using (
    exists (
      select 1
      from public.payments p
      where p.id = featured_purchases.payment_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "featured purchases admin select" on public.featured_purchases;
create policy "featured purchases admin select"
  on public.featured_purchases
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "featured purchases service all" on public.featured_purchases;
create policy "featured purchases service all"
  on public.featured_purchases
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- W6.0: approving featured requests should mark review status only.
create or replace function public.admin_resolve_featured_request(
  p_request_id uuid,
  p_action text,
  p_admin_user_id uuid,
  p_admin_note text default null,
  p_duration_days int default null,
  p_featured_rank int default null
)
returns table (
  id uuid,
  property_id uuid,
  status text,
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  duration_days int,
  requested_until timestamptz,
  property_is_featured boolean,
  property_featured_until timestamptz,
  property_featured_rank int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  req public.featured_requests%rowtype;
  property_row public.properties%rowtype;
  effective_duration int;
  effective_until timestamptz;
  clean_note text;
  now_ts timestamptz := now();
begin
  if p_action not in ('approve', 'reject') then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;

  select * into req
  from public.featured_requests
  where featured_requests.id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  select * into property_row
  from public.properties
  where properties.id = req.property_id
  for update;

  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  clean_note := nullif(btrim(coalesce(p_admin_note, '')), '');

  if p_action = 'approve' then
    if property_row.is_demo is true then
      raise exception 'DEMO_PROPERTY_BLOCKED' using errcode = 'P0001';
    end if;

    if p_duration_days is null then
      effective_duration := req.duration_days;
    else
      effective_duration := p_duration_days;
    end if;

    if effective_duration is not null and effective_duration not in (7, 30) then
      raise exception 'INVALID_DURATION' using errcode = '22023';
    end if;

    effective_until := case
      when effective_duration is null then null
      else now_ts + make_interval(days => effective_duration)
    end;

    update public.featured_requests
    set status = 'approved',
        admin_note = clean_note,
        decided_by = p_admin_user_id,
        decided_at = now_ts,
        duration_days = effective_duration,
        requested_until = effective_until,
        updated_at = now_ts
    where featured_requests.id = req.id;
  else
    update public.featured_requests
    set status = 'rejected',
        admin_note = clean_note,
        decided_by = p_admin_user_id,
        decided_at = now_ts,
        updated_at = now_ts
    where featured_requests.id = req.id;
  end if;

  return query
  select
    fr.id,
    fr.property_id,
    fr.status,
    fr.admin_note,
    fr.decided_by,
    fr.decided_at,
    fr.duration_days,
    fr.requested_until,
    p.is_featured,
    p.featured_until,
    p.featured_rank
  from public.featured_requests fr
  join public.properties p on p.id = fr.property_id
  where fr.id = req.id;
end;
$$;

revoke all on function public.admin_resolve_featured_request(uuid, text, uuid, text, int, int) from public;
grant execute on function public.admin_resolve_featured_request(uuid, text, uuid, text, int, int) to service_role;
