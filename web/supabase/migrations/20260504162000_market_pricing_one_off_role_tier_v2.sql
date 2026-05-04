alter table public.market_one_off_price_book
  add column if not exists role text,
  add column if not exists tier text;

alter table public.market_one_off_price_book
  drop constraint if exists market_one_off_price_book_role_check,
  drop constraint if exists market_one_off_price_book_tier_check,
  drop constraint if exists market_one_off_price_book_role_tier_check;

alter table public.market_one_off_price_book
  add constraint market_one_off_price_book_role_check check (
    role is null or role in ('tenant', 'landlord', 'agent')
  ),
  add constraint market_one_off_price_book_tier_check check (
    tier is null or tier in ('free', 'starter', 'pro', 'tenant_pro', 'enterprise')
  ),
  add constraint market_one_off_price_book_role_tier_check check (
    (role is null and tier is null)
    or (role = 'tenant' and tier in ('free', 'tenant_pro'))
    or (role = 'landlord' and tier in ('free', 'starter', 'pro'))
    or (role = 'agent' and tier in ('free', 'starter', 'pro', 'enterprise'))
  );

drop index if exists public.market_one_off_price_book_active_key_unique;

create unique index if not exists market_one_off_price_book_active_key_unique
  on public.market_one_off_price_book (
    market_country,
    product_code,
    provider,
    coalesce(role, '__all__'),
    coalesce(tier, '__all__')
  )
  where active = true;

create index if not exists market_one_off_price_book_role_tier_idx
  on public.market_one_off_price_book (market_country, product_code, role, tier, active);

insert into public.market_one_off_price_book (
  id,
  market_country,
  product_code,
  currency,
  amount_minor,
  provider,
  role,
  tier,
  enabled,
  effective_from,
  active,
  operator_notes,
  created_at,
  updated_at
)
values
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000211'::uuid,
    'CA',
    'listing_submission',
    'CAD',
    400,
    'stripe',
    'landlord',
    'free',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Policy default for landlord free. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000212'::uuid,
    'CA',
    'listing_submission',
    'CAD',
    400,
    'stripe',
    'agent',
    'free',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Policy default for agent free. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000213'::uuid,
    'CA',
    'listing_submission',
    'CAD',
    200,
    'stripe',
    'agent',
    'pro',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Promotional default for agent pro. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000214'::uuid,
    'CA',
    'listing_submission',
    'CAD',
    100,
    'stripe',
    'agent',
    'enterprise',
    false,
    null,
    false,
    'Canada rental PAYG pilot planning row only. Enterprise is not a runtime tier yet, so this row stays inactive and does not enable checkout.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000215'::uuid,
    'CA',
    'featured_listing_7d',
    'CAD',
    1000,
    'stripe',
    'landlord',
    'free',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Standard featured listing default for landlord free. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000216'::uuid,
    'CA',
    'featured_listing_7d',
    'CAD',
    1000,
    'stripe',
    'agent',
    'free',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Standard featured listing default for agent free. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000217'::uuid,
    'CA',
    'featured_listing_7d',
    'CAD',
    1000,
    'stripe',
    'agent',
    'pro',
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Standard featured listing default for agent pro. Does not enable checkout or runtime pricing.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000218'::uuid,
    'CA',
    'featured_listing_7d',
    'CAD',
    500,
    'stripe',
    'agent',
    'enterprise',
    false,
    null,
    false,
    'Canada rental PAYG pilot planning row only. Enterprise featured pricing is planning-only until Enterprise runtime tier support exists.',
    now(),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000219'::uuid,
    'CA',
    'featured_listing_30d',
    'CAD',
    0,
    'stripe',
    null,
    null,
    false,
    null,
    true,
    'Canada rental PAYG pilot planning row only. Featured listing 30d remains disabled until separately approved. Does not enable checkout or runtime pricing.',
    now(),
    now()
  )
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
values
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000311'::uuid,
    'market_one_off_price',
    '9fd6b8c1-5d5e-4f4f-9d53-000000000211'::uuid,
    'CA',
    'seeded',
    null,
    null,
    jsonb_build_object('market_country', 'CA', 'product_code', 'listing_submission', 'provider', 'stripe', 'role', 'landlord', 'tier', 'free'),
    now()
  ),
  (
    '9fd6b8c1-5d5e-4f4f-9d53-000000000312'::uuid,
    'market_one_off_price',
    '9fd6b8c1-5d5e-4f4f-9d53-000000000214'::uuid,
    'CA',
    'seeded',
    null,
    null,
    jsonb_build_object('market_country', 'CA', 'product_code', 'listing_submission', 'provider', 'stripe', 'role', 'agent', 'tier', 'enterprise', 'active', false),
    now()
  )
on conflict (id) do nothing;
