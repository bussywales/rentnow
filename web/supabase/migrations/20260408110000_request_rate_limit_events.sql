create table if not exists public.request_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  route_key text not null,
  scope_key text not null,
  is_authenticated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists request_rate_limit_events_route_scope_created_idx
  on public.request_rate_limit_events (route_key, scope_key, created_at desc);

create index if not exists request_rate_limit_events_created_idx
  on public.request_rate_limit_events (created_at desc);

alter table public.request_rate_limit_events enable row level security;

drop policy if exists "request rate limit admin read" on public.request_rate_limit_events;
create policy "request rate limit admin read" on public.request_rate_limit_events
  for select
  using (public.is_admin());
