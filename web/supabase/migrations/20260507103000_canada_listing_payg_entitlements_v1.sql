create table if not exists public.canada_listing_payg_entitlements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  market_country text not null default 'CA',
  provider text not null default 'stripe',
  purpose text not null default 'listing_submission',
  role text not null,
  tier text not null,
  amount_minor integer not null,
  currency text not null default 'CAD',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  idempotency_key text not null,
  status text not null,
  active boolean not null default true,
  granted_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canada_listing_payg_entitlements_market_country_check check (market_country = 'CA'),
  constraint canada_listing_payg_entitlements_provider_check check (provider = 'stripe'),
  constraint canada_listing_payg_entitlements_purpose_check check (purpose = 'listing_submission'),
  constraint canada_listing_payg_entitlements_currency_check check (currency = 'CAD'),
  constraint canada_listing_payg_entitlements_role_check check (role in ('landlord', 'agent')),
  constraint canada_listing_payg_entitlements_tier_check check (tier in ('free', 'pro')),
  constraint canada_listing_payg_entitlements_role_tier_check check (
    (role = 'landlord' and tier = 'free')
    or (role = 'agent' and tier in ('free', 'pro'))
  ),
  constraint canada_listing_payg_entitlements_amount_minor_check check (amount_minor >= 0),
  constraint canada_listing_payg_entitlements_status_check check (status in ('granted', 'consumed', 'revoked', 'expired')),
  constraint canada_listing_payg_entitlements_active_status_check check (
    (active = true and status = 'granted')
    or (active = false and status in ('consumed', 'revoked', 'expired'))
  )
);

create index if not exists idx_canada_listing_payg_entitlements_listing
  on public.canada_listing_payg_entitlements (listing_id, created_at desc);

create index if not exists idx_canada_listing_payg_entitlements_owner
  on public.canada_listing_payg_entitlements (owner_id, created_at desc);

create index if not exists idx_canada_listing_payg_entitlements_status
  on public.canada_listing_payg_entitlements (status, created_at desc);

create unique index if not exists idx_canada_listing_payg_entitlements_idempotency_key
  on public.canada_listing_payg_entitlements (idempotency_key);

create unique index if not exists idx_canada_listing_payg_entitlements_checkout_session
  on public.canada_listing_payg_entitlements (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists idx_canada_listing_payg_entitlements_payment_intent
  on public.canada_listing_payg_entitlements (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists idx_canada_listing_payg_entitlements_event_id
  on public.canada_listing_payg_entitlements (stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists idx_canada_listing_payg_entitlements_listing_active_granted
  on public.canada_listing_payg_entitlements (listing_id)
  where active = true and status = 'granted';

drop trigger if exists trg_canada_listing_payg_entitlements_updated_at on public.canada_listing_payg_entitlements;
create trigger trg_canada_listing_payg_entitlements_updated_at
before update on public.canada_listing_payg_entitlements
for each row execute function public.touch_updated_at();

alter table public.canada_listing_payg_entitlements enable row level security;
alter table public.canada_listing_payg_entitlements force row level security;

drop policy if exists "canada listing payg entitlements admin select" on public.canada_listing_payg_entitlements;
create policy "canada listing payg entitlements admin select"
  on public.canada_listing_payg_entitlements
  for select
  using (public.is_admin());

drop policy if exists "canada listing payg entitlements service write" on public.canada_listing_payg_entitlements;
create policy "canada listing payg entitlements service write"
  on public.canada_listing_payg_entitlements
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "canada listing payg entitlements admin write" on public.canada_listing_payg_entitlements;
create policy "canada listing payg entitlements admin write"
  on public.canada_listing_payg_entitlements
  for all
  using (public.is_admin())
  with check (public.is_admin());
