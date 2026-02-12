-- Featured v1.1: host/agent featured requests queue with admin approval.

create table if not exists public.featured_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_role text not null,
  duration_days int null,
  requested_until timestamptz null,
  note text null,
  status text not null default 'pending',
  admin_note text null,
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_requests_role_chk check (requester_role in ('agent', 'landlord')),
  constraint featured_requests_duration_chk check (duration_days is null or duration_days in (7, 30)),
  constraint featured_requests_note_len_chk check (note is null or char_length(note) <= 280),
  constraint featured_requests_status_chk check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create unique index if not exists featured_requests_property_pending_unique
  on public.featured_requests (property_id)
  where status = 'pending';

create index if not exists featured_requests_status_created_idx
  on public.featured_requests (status, created_at desc);

create index if not exists featured_requests_property_idx
  on public.featured_requests (property_id);

create index if not exists featured_requests_requester_idx
  on public.featured_requests (requester_user_id, created_at desc);

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

    update public.properties
    set is_featured = true,
        featured_until = effective_until,
        featured_rank = p_featured_rank,
        featured_at = now_ts,
        featured_by = p_admin_user_id,
        updated_at = now_ts
    where properties.id = req.property_id;

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

create or replace function public.touch_featured_requests_updated_at()
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

drop trigger if exists featured_requests_touch_updated_at on public.featured_requests;
create trigger featured_requests_touch_updated_at
before update on public.featured_requests
for each row execute function public.touch_featured_requests_updated_at();

alter table public.featured_requests enable row level security;
alter table public.featured_requests force row level security;

drop policy if exists "featured requests requester select" on public.featured_requests;
create policy "featured requests requester select"
  on public.featured_requests
  for select
  using (auth.uid() = requester_user_id);

drop policy if exists "featured requests requester insert" on public.featured_requests;
create policy "featured requests requester insert"
  on public.featured_requests
  for insert
  with check (
    auth.uid() = requester_user_id
    and requester_role in ('agent', 'landlord')
    and exists (
      select 1
      from public.properties p
      where p.id = featured_requests.property_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "featured requests requester cancel" on public.featured_requests;
create policy "featured requests requester cancel"
  on public.featured_requests
  for update
  using (auth.uid() = requester_user_id and status = 'pending')
  with check (
    auth.uid() = requester_user_id
    and status in ('pending', 'cancelled')
  );

drop policy if exists "featured requests admin select" on public.featured_requests;
create policy "featured requests admin select"
  on public.featured_requests
  for select
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
  );

drop policy if exists "featured requests admin update" on public.featured_requests;
create policy "featured requests admin update"
  on public.featured_requests
  for update
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
  );

drop policy if exists "featured requests service all" on public.featured_requests;
create policy "featured requests service all"
  on public.featured_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
