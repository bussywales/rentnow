create table if not exists public.market_billing_policies (
  id uuid primary key default gen_random_uuid(),
  market_country text not null,
  currency text not null,
  policy_state text not null,
  rental_enabled boolean not null default false,
  sale_enabled boolean not null default false,
  shortlet_enabled boolean not null default false,
  payg_listing_enabled boolean not null default false,
  featured_listing_enabled boolean not null default false,
  subscription_checkout_enabled boolean not null default false,
  listing_payg_provider text,
  featured_listing_provider text,
  operator_notes text,
  effective_from timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_billing_policies_country_check check (market_country ~ '^[A-Z]{2}$'),
  constraint market_billing_policies_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint market_billing_policies_policy_state_check check (policy_state in ('draft', 'approved', 'live', 'disabled')),
  constraint market_billing_policies_listing_provider_check check (
    listing_payg_provider is null or listing_payg_provider in ('stripe', 'paystack', 'flutterwave')
  ),
  constraint market_billing_policies_featured_provider_check check (
    featured_listing_provider is null or featured_listing_provider in ('stripe', 'paystack', 'flutterwave')
  )
);

create table if not exists public.market_listing_entitlements (
  id uuid primary key default gen_random_uuid(),
  market_country text not null,
  role text not null,
  tier text not null,
  active_listing_limit integer not null,
  listing_credits integer not null default 0,
  featured_credits integer not null default 0,
  client_page_limit integer,
  payg_beyond_cap_enabled boolean not null default false,
  operator_notes text,
  effective_from timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_listing_entitlements_country_check check (market_country ~ '^[A-Z]{2}$'),
  constraint market_listing_entitlements_role_check check (role in ('tenant', 'landlord', 'agent')),
  constraint market_listing_entitlements_tier_check check (tier in ('free', 'starter', 'pro', 'tenant_pro')),
  constraint market_listing_entitlements_limit_check check (active_listing_limit >= 0),
  constraint market_listing_entitlements_listing_credits_check check (listing_credits >= 0),
  constraint market_listing_entitlements_featured_credits_check check (featured_credits >= 0),
  constraint market_listing_entitlements_client_page_limit_check check (client_page_limit is null or client_page_limit >= 0),
  constraint market_listing_entitlements_role_tier_check check (
    (role = 'tenant' and tier in ('free', 'tenant_pro'))
    or (role in ('landlord', 'agent') and tier in ('free', 'starter', 'pro'))
  )
);

create table if not exists public.market_one_off_price_book (
  id uuid primary key default gen_random_uuid(),
  market_country text not null,
  product_code text not null,
  currency text not null,
  amount_minor integer not null,
  provider text not null,
  enabled boolean not null default false,
  effective_from timestamptz,
  active boolean not null default true,
  operator_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_one_off_price_book_country_check check (market_country ~ '^[A-Z]{2}$'),
  constraint market_one_off_price_book_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint market_one_off_price_book_product_code_check check (product_code in ('listing_submission', 'featured_listing_7d', 'featured_listing_30d')),
  constraint market_one_off_price_book_provider_check check (provider in ('stripe', 'paystack', 'flutterwave')),
  constraint market_one_off_price_book_amount_check check (amount_minor >= 0)
);

create table if not exists public.market_pricing_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  market_country text,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_snapshot jsonb,
  next_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint market_pricing_audit_log_entity_type_check check (entity_type in ('market_billing_policy', 'market_listing_entitlement', 'market_one_off_price')),
  constraint market_pricing_audit_log_country_check check (market_country is null or market_country ~ '^[A-Z]{2}$')
);

create unique index if not exists market_billing_policies_active_market_unique
  on public.market_billing_policies (market_country)
  where active = true;

create index if not exists market_billing_policies_market_idx
  on public.market_billing_policies (market_country, active);

create index if not exists market_billing_policies_state_idx
  on public.market_billing_policies (policy_state, active);

create unique index if not exists market_listing_entitlements_active_key_unique
  on public.market_listing_entitlements (market_country, role, tier)
  where active = true;

create index if not exists market_listing_entitlements_market_idx
  on public.market_listing_entitlements (market_country, active);

create index if not exists market_listing_entitlements_role_tier_idx
  on public.market_listing_entitlements (role, tier, active);

create unique index if not exists market_one_off_price_book_active_key_unique
  on public.market_one_off_price_book (market_country, product_code, provider)
  where active = true;

create index if not exists market_one_off_price_book_market_idx
  on public.market_one_off_price_book (market_country, active);

create index if not exists market_one_off_price_book_product_idx
  on public.market_one_off_price_book (product_code, active);

create index if not exists market_pricing_audit_log_created_idx
  on public.market_pricing_audit_log (created_at desc);

create index if not exists market_pricing_audit_log_lookup_idx
  on public.market_pricing_audit_log (entity_type, market_country, created_at desc);

alter table public.market_billing_policies enable row level security;
alter table public.market_billing_policies force row level security;
alter table public.market_listing_entitlements enable row level security;
alter table public.market_listing_entitlements force row level security;
alter table public.market_one_off_price_book enable row level security;
alter table public.market_one_off_price_book force row level security;
alter table public.market_pricing_audit_log enable row level security;
alter table public.market_pricing_audit_log force row level security;

drop policy if exists "market billing policies admin select" on public.market_billing_policies;
create policy "market billing policies admin select" on public.market_billing_policies
  for select using (public.is_admin());

drop policy if exists "market billing policies admin manage" on public.market_billing_policies;
create policy "market billing policies admin manage" on public.market_billing_policies
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "market listing entitlements admin select" on public.market_listing_entitlements;
create policy "market listing entitlements admin select" on public.market_listing_entitlements
  for select using (public.is_admin());

drop policy if exists "market listing entitlements admin manage" on public.market_listing_entitlements;
create policy "market listing entitlements admin manage" on public.market_listing_entitlements
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "market one off price book admin select" on public.market_one_off_price_book;
create policy "market one off price book admin select" on public.market_one_off_price_book
  for select using (public.is_admin());

drop policy if exists "market one off price book admin manage" on public.market_one_off_price_book;
create policy "market one off price book admin manage" on public.market_one_off_price_book
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "market pricing audit log admin select" on public.market_pricing_audit_log;
create policy "market pricing audit log admin select" on public.market_pricing_audit_log
  for select using (public.is_admin());

drop policy if exists "market pricing audit log admin manage" on public.market_pricing_audit_log;
create policy "market pricing audit log admin manage" on public.market_pricing_audit_log
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists market_billing_policies_touch_updated_at on public.market_billing_policies;
create trigger market_billing_policies_touch_updated_at
before update on public.market_billing_policies
for each row execute function public.touch_updated_at();

drop trigger if exists market_listing_entitlements_touch_updated_at on public.market_listing_entitlements;
create trigger market_listing_entitlements_touch_updated_at
before update on public.market_listing_entitlements
for each row execute function public.touch_updated_at();

drop trigger if exists market_one_off_price_book_touch_updated_at on public.market_one_off_price_book;
create trigger market_one_off_price_book_touch_updated_at
before update on public.market_one_off_price_book
for each row execute function public.touch_updated_at();

with legacy_settings as (
  select
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'payg_enabled' limit 1), true) as payg_enabled,
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'subscriptions_enabled' limit 1), false) as subscriptions_enabled,
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'featured_listings_enabled' limit 1), true) as featured_listings_enabled,
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'shortlet_payments_stripe_enabled' limit 1), true) as shortlet_payments_stripe_enabled,
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'shortlet_payments_paystack_enabled' limit 1), true) as shortlet_payments_paystack_enabled,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'payg_listing_fee_amount' limit 1), 2000) as payg_listing_fee_amount,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_7d_minor' limit 1), 1999) as featured_price_7d_minor,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_30d_minor' limit 1), 4999) as featured_price_30d_minor,
    coalesce((select upper(value->>'value') from public.app_settings where key = 'featured_currency' limit 1), 'NGN') as featured_currency
)
insert into public.market_billing_policies (
  id,
  market_country,
  currency,
  policy_state,
  rental_enabled,
  sale_enabled,
  shortlet_enabled,
  payg_listing_enabled,
  featured_listing_enabled,
  subscription_checkout_enabled,
  listing_payg_provider,
  featured_listing_provider,
  operator_notes,
  effective_from,
  active,
  created_at,
  updated_at
)
select
  '9fd6b8c1-5d5e-4f4f-9d53-000000000001'::uuid,
  'NG',
  'NGN',
  'live',
  true,
  true,
  (legacy_settings.shortlet_payments_stripe_enabled or legacy_settings.shortlet_payments_paystack_enabled),
  legacy_settings.payg_enabled,
  legacy_settings.featured_listings_enabled,
  legacy_settings.subscriptions_enabled,
  'paystack',
  'paystack',
  'Seeded from current Nigeria runtime truth. Listing PAYG, featured fees, and entitlements still execute through legacy settings/code constants until a future integration batch explicitly switches runtime reads.',
  now(),
  true,
  now(),
  now()
from legacy_settings
on conflict (id) do nothing;

insert into public.market_billing_policies (
  id,
  market_country,
  currency,
  policy_state,
  rental_enabled,
  sale_enabled,
  shortlet_enabled,
  payg_listing_enabled,
  featured_listing_enabled,
  subscription_checkout_enabled,
  listing_payg_provider,
  featured_listing_provider,
  operator_notes,
  effective_from,
  active,
  created_at,
  updated_at
)
values (
  '9fd6b8c1-5d5e-4f4f-9d53-000000000002'::uuid,
  'CA',
  'CAD',
  'draft',
  false,
  false,
  false,
  false,
  false,
  false,
  'stripe',
  'stripe',
  'Canada PAYG and market entitlements remain policy-gated. Draft rows do not enable checkout, and no Canada runtime integration should ship before explicit policy approval.',
  null,
  true,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.market_listing_entitlements (
  id,
  market_country,
  role,
  tier,
  active_listing_limit,
  listing_credits,
  featured_credits,
  client_page_limit,
  payg_beyond_cap_enabled,
  operator_notes,
  effective_from,
  active,
  created_at,
  updated_at
)
select
  seed.id,
  'NG',
  seed.role,
  seed.tier,
  seed.active_listing_limit,
  coalesce(plan.listing_credits, 0),
  coalesce(plan.featured_credits, 0),
  null,
  false,
  seed.operator_notes,
  now(),
  true,
  now(),
  now()
from (
  values
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000101'::uuid, 'landlord', 'free', 1, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000102'::uuid, 'landlord', 'starter', 3, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000103'::uuid, 'landlord', 'pro', 10, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000104'::uuid, 'agent', 'free', 1, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000105'::uuid, 'agent', 'starter', 3, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000106'::uuid, 'agent', 'pro', 10, 'Seeded from current code-defined listing limits in web/lib/plans.ts. Runtime still reads plans.ts plus profile_plans.max_listings_override.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000107'::uuid, 'tenant', 'free', 0, 'Tenant role remains listing-blocked in current runtime even though tenant billing tiers exist separately. This row is a future control-plane placeholder, not an active publish entitlement source.'),
    ('9fd6b8c1-5d5e-4f4f-9d53-000000000108'::uuid, 'tenant', 'tenant_pro', 0, 'Tenant role remains listing-blocked in current runtime even though tenant billing tiers exist separately. This row is a future control-plane placeholder, not an active publish entitlement source.')
) as seed(id, role, tier, active_listing_limit, operator_notes)
left join public.plans plan
  on plan.role = seed.role
 and plan.tier = seed.tier
 and coalesce(plan.is_active, true) = true
on conflict (id) do nothing;

with legacy_settings as (
  select
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'payg_enabled' limit 1), true) as payg_enabled,
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'featured_listings_enabled' limit 1), true) as featured_listings_enabled,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'payg_listing_fee_amount' limit 1), 2000) as payg_listing_fee_amount,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_7d_minor' limit 1), 1999) as featured_price_7d_minor,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_30d_minor' limit 1), 4999) as featured_price_30d_minor,
    coalesce((select upper(value->>'value') from public.app_settings where key = 'featured_currency' limit 1), 'NGN') as featured_currency
)
insert into public.market_one_off_price_book (
  id,
  market_country,
  product_code,
  currency,
  amount_minor,
  provider,
  enabled,
  effective_from,
  active,
  operator_notes,
  created_at,
  updated_at
)
select
  '9fd6b8c1-5d5e-4f4f-9d53-000000000201'::uuid,
  'NG',
  'listing_submission',
  'NGN',
  legacy_settings.payg_listing_fee_amount,
  'paystack',
  legacy_settings.payg_enabled,
  now(),
  true,
  'Seeded from legacy PAYG listing configuration in app_settings plus web/lib/billing/payg.ts defaults. Runtime checkout still reads the legacy source.',
  now(),
  now()
from legacy_settings
on conflict (id) do nothing;

with legacy_settings as (
  select
    coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'featured_listings_enabled' limit 1), true) as featured_listings_enabled,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_7d_minor' limit 1), 1999) as featured_price_7d_minor,
    coalesce((select (value->>'value')::integer from public.app_settings where key = 'featured_price_30d_minor' limit 1), 4999) as featured_price_30d_minor,
    coalesce((select upper(value->>'value') from public.app_settings where key = 'featured_currency' limit 1), 'NGN') as featured_currency
)
insert into public.market_one_off_price_book (
  id,
  market_country,
  product_code,
  currency,
  amount_minor,
  provider,
  enabled,
  effective_from,
  active,
  operator_notes,
  created_at,
  updated_at
)
select * from (
  select
    '9fd6b8c1-5d5e-4f4f-9d53-000000000202'::uuid as id,
    'NG'::text as market_country,
    'featured_listing_7d'::text as product_code,
    legacy_settings.featured_currency as currency,
    legacy_settings.featured_price_7d_minor as amount_minor,
    'paystack'::text as provider,
    legacy_settings.featured_listings_enabled as enabled,
    now() as effective_from,
    true as active,
    'Seeded from existing featured pricing settings for future market-aware control-plane use. Runtime featured checkout still uses legacy featured config until integration is explicitly shipped.'::text as operator_notes,
    now() as created_at,
    now() as updated_at
  from legacy_settings
  union all
  select
    '9fd6b8c1-5d5e-4f4f-9d53-000000000203'::uuid,
    'NG',
    'featured_listing_30d',
    legacy_settings.featured_currency,
    legacy_settings.featured_price_30d_minor,
    'paystack',
    legacy_settings.featured_listings_enabled,
    now(),
    true,
    'Seeded from existing featured pricing settings for future market-aware control-plane use. Runtime featured checkout still uses legacy featured config until integration is explicitly shipped.',
    now(),
    now()
  from legacy_settings
) seeded_rows
on conflict (id) do nothing;

insert into public.market_pricing_audit_log (
  id,
  entity_type,
  entity_id,
  market_country,
  event_type,
  actor_id,
  previous_snapshot,
  next_snapshot,
  created_at
)
select * from (
  select
    '9fd6b8c1-5d5e-4f4f-9d53-000000000301'::uuid,
    'market_billing_policy'::text,
    '9fd6b8c1-5d5e-4f4f-9d53-000000000001'::uuid,
    'NG'::text,
    'seeded'::text,
    null::uuid,
    null::jsonb,
    jsonb_build_object('market_country', 'NG', 'policy_state', 'live', 'currency', 'NGN'),
    now()
  union all
  select
    '9fd6b8c1-5d5e-4f4f-9d53-000000000302'::uuid,
    'market_billing_policy',
    '9fd6b8c1-5d5e-4f4f-9d53-000000000002'::uuid,
    'CA',
    'seeded',
    null,
    null,
    jsonb_build_object('market_country', 'CA', 'policy_state', 'draft', 'currency', 'CAD'),
    now()
  union all
  select
    '9fd6b8c1-5d5e-4f4f-9d53-000000000303'::uuid,
    'market_one_off_price',
    '9fd6b8c1-5d5e-4f4f-9d53-000000000201'::uuid,
    'NG',
    'seeded',
    null,
    null,
    jsonb_build_object('market_country', 'NG', 'product_code', 'listing_submission', 'provider', 'paystack'),
    now()
) seeded_audit_rows
on conflict (id) do nothing;
