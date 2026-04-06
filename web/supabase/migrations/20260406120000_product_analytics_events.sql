-- Product analytics foundation for acquisition attribution and funnel instrumentation.

create table if not exists public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  event_family text not null,
  page_path text,
  session_key text,
  user_id uuid references public.profiles (id) on delete set null,
  user_role text,
  market text,
  intent text,
  city text,
  area text,
  property_type text,
  listing_id uuid references public.properties (id) on delete set null,
  listing_status text,
  plan_tier text,
  cadence text,
  billing_source text,
  currency text,
  amount numeric(12,2),
  provider text,
  provider_subscription_id text,
  request_status text,
  share_channel text,
  search_source text,
  results_count integer,
  filter_count integer,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_path text,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists idx_product_analytics_events_created_at
  on public.product_analytics_events (created_at desc);

create index if not exists idx_product_analytics_events_event_name_created_at
  on public.product_analytics_events (event_name, created_at desc);

create index if not exists idx_product_analytics_events_event_family_created_at
  on public.product_analytics_events (event_family, created_at desc);

create index if not exists idx_product_analytics_events_source_medium_campaign
  on public.product_analytics_events (utm_source, utm_medium, utm_campaign, created_at desc);

create index if not exists idx_product_analytics_events_listing_created_at
  on public.product_analytics_events (listing_id, created_at desc)
  where listing_id is not null;

create index if not exists idx_product_analytics_events_user_created_at
  on public.product_analytics_events (user_id, created_at desc)
  where user_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_analytics_events_event_name_check'
      and conrelid = 'public.product_analytics_events'::regclass
  ) then
    alter table public.product_analytics_events
      add constraint product_analytics_events_event_name_check
      check (
        event_name in (
          'search_performed',
          'filter_applied',
          'result_clicked',
          'listing_viewed',
          'listing_save_clicked',
          'listing_unsave_clicked',
          'shortlist_created',
          'shortlist_shared',
          'property_request_started',
          'property_request_published',
          'contact_submitted',
          'viewing_request_submitted',
          'billing_page_viewed',
          'plan_selected',
          'checkout_started',
          'checkout_succeeded',
          'listing_created',
          'listing_submitted_for_review',
          'listing_published_live'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_analytics_events_event_family_check'
      and conrelid = 'public.product_analytics_events'::regclass
  ) then
    alter table public.product_analytics_events
      add constraint product_analytics_events_event_family_check
      check (
        event_family in (
          'search_browse',
          'listing_engagement',
          'tenant_intent',
          'billing',
          'host_activation'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_analytics_events_cadence_check'
      and conrelid = 'public.product_analytics_events'::regclass
  ) then
    alter table public.product_analytics_events
      add constraint product_analytics_events_cadence_check
      check (cadence is null or cadence in ('monthly', 'yearly'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_analytics_events_amount_check'
      and conrelid = 'public.product_analytics_events'::regclass
  ) then
    alter table public.product_analytics_events
      add constraint product_analytics_events_amount_check
      check (amount is null or amount >= 0);
  end if;
end $$;

alter table public.product_analytics_events enable row level security;
alter table public.product_analytics_events force row level security;

drop policy if exists "product analytics insert anon" on public.product_analytics_events;
create policy "product analytics insert anon" on public.product_analytics_events
for insert to anon
with check (user_id is null);

drop policy if exists "product analytics insert authenticated" on public.product_analytics_events;
create policy "product analytics insert authenticated" on public.product_analytics_events
for insert to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "product analytics admin select" on public.product_analytics_events;
create policy "product analytics admin select" on public.product_analytics_events
for select to authenticated
using (public.is_admin());
