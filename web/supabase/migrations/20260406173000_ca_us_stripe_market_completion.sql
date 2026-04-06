alter table public.stripe_webhook_events
  add column if not exists subscription_market_country text,
  add column if not exists subscription_market_currency text;

insert into public.subscription_price_book (
  id,
  product_area,
  role,
  tier,
  cadence,
  market_country,
  currency,
  amount_minor,
  provider,
  provider_price_ref,
  active,
  fallback_eligible,
  effective_at,
  display_order,
  badge,
  operator_notes
)
select
  seed.id,
  'subscriptions',
  seed.role,
  seed.tier,
  seed.cadence,
  seed.market_country,
  seed.currency,
  seed.amount_minor,
  'stripe',
  seed.provider_price_ref,
  true,
  false,
  '2026-04-06T17:30:00Z'::timestamptz,
  seed.display_order,
  'Interim',
  seed.operator_notes
from (
  values
    ('7c9c42b0-a9d6-4f6a-8d11-000000000101', 'tenant', 'tenant_pro', 'monthly', 'CA', 'GBP', 999, 'price_1SlJ5oIrMBE5QKLYNyx9zRsk', 10, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000102', 'tenant', 'tenant_pro', 'yearly', 'CA', 'GBP', 9900, 'price_1SlJ5pIrMBE5QKLYVUzErImu', 11, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000103', 'landlord', 'pro', 'monthly', 'CA', 'GBP', 1999, 'price_1SkqYmIrMBE5QKLYKWlzcPLq', 20, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000104', 'landlord', 'pro', 'yearly', 'CA', 'GBP', 19900, 'price_1SkqYmIrMBE5QKLYh3mSDLw4', 21, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000105', 'agent', 'pro', 'monthly', 'CA', 'GBP', 4999, 'price_1SkqghIrMBE5QKLYnMjdVunO', 30, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000106', 'agent', 'pro', 'yearly', 'CA', 'GBP', 49900, 'price_1SkqghIrMBE5QKLYWiKW0LAQ', 31, 'Interim Canada Stripe pricing. Checkout is intentional and currently charges in GBP until CAD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000107', 'tenant', 'tenant_pro', 'monthly', 'US', 'GBP', 999, 'price_1SlJ5oIrMBE5QKLYNyx9zRsk', 10, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000108', 'tenant', 'tenant_pro', 'yearly', 'US', 'GBP', 9900, 'price_1SlJ5pIrMBE5QKLYVUzErImu', 11, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000109', 'landlord', 'pro', 'monthly', 'US', 'GBP', 1999, 'price_1SkqYmIrMBE5QKLYKWlzcPLq', 20, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000110', 'landlord', 'pro', 'yearly', 'US', 'GBP', 19900, 'price_1SkqYmIrMBE5QKLYh3mSDLw4', 21, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000111', 'agent', 'pro', 'monthly', 'US', 'GBP', 4999, 'price_1SkqghIrMBE5QKLYnMjdVunO', 30, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.'),
    ('7c9c42b0-a9d6-4f6a-8d11-000000000112', 'agent', 'pro', 'yearly', 'US', 'GBP', 49900, 'price_1SkqghIrMBE5QKLYWiKW0LAQ', 31, 'Interim United States Stripe pricing. Checkout is intentional and currently charges in GBP until USD recurring prices are linked.')
) as seed(
  id,
  role,
  tier,
  cadence,
  market_country,
  currency,
  amount_minor,
  provider_price_ref,
  display_order,
  operator_notes
)
where not exists (
  select 1
  from public.subscription_price_book existing
  where existing.product_area = 'subscriptions'
    and existing.role = seed.role
    and existing.tier = seed.tier
    and existing.cadence = seed.cadence
    and existing.market_country = seed.market_country
    and existing.active = true
    and existing.ends_at is null
);
