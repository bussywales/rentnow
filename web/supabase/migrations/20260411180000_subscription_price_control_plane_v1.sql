alter table public.subscription_price_book
  add column if not exists workflow_state text not null default 'active';

alter table public.subscription_price_book
  add column if not exists replaces_price_book_id uuid references public.subscription_price_book(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscription_price_book_workflow_state_check'
  ) then
    alter table public.subscription_price_book
      add constraint subscription_price_book_workflow_state_check
      check (workflow_state in ('draft', 'active', 'archived'));
  end if;
end $$;

update public.subscription_price_book
set workflow_state = case
  when active = true and ends_at is null then 'active'
  else 'archived'
end
where workflow_state not in ('draft', 'active', 'archived')
   or workflow_state is null;

create unique index if not exists subscription_price_book_draft_current_unique
  on public.subscription_price_book (product_area, role, tier, cadence, market_country)
  where workflow_state = 'draft' and ends_at is null;

create index if not exists subscription_price_book_workflow_idx
  on public.subscription_price_book (workflow_state, market_country, role, cadence);

create table if not exists public.subscription_price_book_audit_log (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid references public.subscription_price_book(id) on delete set null,
  market_country text not null,
  role text not null,
  tier text not null,
  cadence text not null,
  provider text not null,
  event_type text not null check (event_type in ('draft_created', 'draft_updated', 'published')),
  actor_id uuid references public.profiles(id) on delete set null,
  previous_snapshot jsonb,
  next_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_price_book_audit_log_created_idx
  on public.subscription_price_book_audit_log (created_at desc);

create index if not exists subscription_price_book_audit_log_lookup_idx
  on public.subscription_price_book_audit_log (market_country, role, cadence);

alter table public.subscription_price_book_audit_log enable row level security;

drop policy if exists "subscription price book audit admin read" on public.subscription_price_book_audit_log;
create policy "subscription price book audit admin read" on public.subscription_price_book_audit_log
  for select
  using (public.is_admin());

drop policy if exists "subscription price book audit admin write" on public.subscription_price_book_audit_log;
create policy "subscription price book audit admin write" on public.subscription_price_book_audit_log
  for all
  using (public.is_admin())
  with check (public.is_admin());
