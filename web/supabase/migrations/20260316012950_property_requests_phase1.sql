-- Property Requests Phase 1 foundation

create table if not exists public.property_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_role text not null,
  intent text not null,
  market_code text not null,
  currency_code text not null,
  city text null,
  area text null,
  location_text text null,
  budget_min integer null,
  budget_max integer null,
  property_type text null,
  bedrooms integer null,
  bathrooms integer null,
  furnished boolean null,
  move_timeline text null,
  shortlet_duration text null,
  notes text null,
  status text not null default 'draft',
  published_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_requests_owner_role_check check (owner_role in ('tenant', 'landlord', 'agent', 'admin')),
  constraint property_requests_intent_check check (intent in ('rent', 'buy', 'shortlet')),
  constraint property_requests_status_check check (status in ('draft', 'open', 'matched', 'closed', 'expired', 'removed')),
  constraint property_requests_market_code_check check (market_code ~ '^[A-Z]{2}$'),
  constraint property_requests_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint property_requests_budget_range_check check (
    (budget_min is null or budget_min >= 0)
    and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_max >= budget_min)
  ),
  constraint property_requests_rooms_check check (
    (bedrooms is null or bedrooms >= 0)
    and (bathrooms is null or bathrooms >= 0)
  ),
  constraint property_requests_publish_state_check check (
    (status = 'draft' and published_at is null)
    or (status in ('open', 'matched', 'closed', 'expired') and published_at is not null)
    or status = 'removed'
  ),
  constraint property_requests_expiry_check check (
    expires_at is null or published_at is null or expires_at >= published_at
  )
);

create index if not exists property_requests_owner_status_updated_idx
  on public.property_requests(owner_user_id, status, updated_at desc);

create index if not exists property_requests_discover_idx
  on public.property_requests(status, market_code, intent, published_at desc);

create index if not exists property_requests_expires_at_idx
  on public.property_requests(expires_at);

create or replace function public.touch_property_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_requests_touch_updated_at on public.property_requests;
create trigger property_requests_touch_updated_at
before update on public.property_requests
for each row execute function public.touch_property_requests_updated_at();

alter table public.property_requests enable row level security;
alter table public.property_requests force row level security;

drop policy if exists "property requests owner select" on public.property_requests;
create policy "property requests owner select"
  on public.property_requests
  for select
  using (owner_user_id = auth.uid());

drop policy if exists "property requests owner insert tenant" on public.property_requests;
create policy "property requests owner insert tenant"
  on public.property_requests
  for insert
  with check (
    owner_user_id = auth.uid()
    and owner_role = 'tenant'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'tenant'
    )
  );

drop policy if exists "property requests owner update" on public.property_requests;
create policy "property requests owner update"
  on public.property_requests
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owner_role = 'tenant');

drop policy if exists "property requests responder read open" on public.property_requests;
create policy "property requests responder read open"
  on public.property_requests
  for select
  using (
    status = 'open'
    and published_at is not null
    and (expires_at is null or expires_at > now())
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('landlord', 'agent')
    )
  );

drop policy if exists "property requests admin read" on public.property_requests;
create policy "property requests admin read"
  on public.property_requests
  for select
  using (public.is_admin());

drop policy if exists "property requests admin write" on public.property_requests;
create policy "property requests admin write"
  on public.property_requests
  for all
  using (public.is_admin())
  with check (public.is_admin());
