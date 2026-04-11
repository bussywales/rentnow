update public.subscription_price_book as book
set
  currency = seed.currency,
  amount_minor = seed.amount_minor,
  provider_price_ref = seed.provider_price_ref,
  badge = null,
  operator_notes = seed.operator_notes,
  updated_at = '2026-04-11T10:30:00Z'::timestamptz,
  updated_by = null
from (
  values
    ('CA', 'tenant', 'tenant_pro', 'monthly', 'CAD', 999, 'price_1TKaEcPjtZ0fKtkBYl45ZvF0', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('CA', 'tenant', 'tenant_pro', 'yearly', 'CAD', 9900, 'price_1TKaFCPjtZ0fKtkBWKJArOEU', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('CA', 'landlord', 'pro', 'monthly', 'CAD', 1999, 'price_1TKaJDPjtZ0fKtkBISh35BGf', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('CA', 'landlord', 'pro', 'yearly', 'CAD', 19900, 'price_1TKaJfPjtZ0fKtkB7GnRxQWJ', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('CA', 'agent', 'pro', 'monthly', 'CAD', 4999, 'price_1TKaUKPjtZ0fKtkBR72YdK8H', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('CA', 'agent', 'pro', 'yearly', 'CAD', 49900, 'price_1TKaUoPjtZ0fKtkBEK9hmPSq', 'Canada local-currency Stripe pricing complete. Linked to live CAD recurring prices.'),
    ('US', 'tenant', 'tenant_pro', 'monthly', 'USD', 999, 'price_1TKaGbPjtZ0fKtkBqRESXfcm', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.'),
    ('US', 'tenant', 'tenant_pro', 'yearly', 'USD', 9900, 'price_1TKaGwPjtZ0fKtkBxC84foEX', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.'),
    ('US', 'landlord', 'pro', 'monthly', 'USD', 1999, 'price_1TKaK0PjtZ0fKtkBvMrNwDOn', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.'),
    ('US', 'landlord', 'pro', 'yearly', 'USD', 19900, 'price_1TKaKXPjtZ0fKtkBCDLk8uah', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.'),
    ('US', 'agent', 'pro', 'monthly', 'USD', 4999, 'price_1TKaVBPjtZ0fKtkBtyUMIh0C', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.'),
    ('US', 'agent', 'pro', 'yearly', 'USD', 49900, 'price_1TKaVTPjtZ0fKtkB3Df0WQbo', 'United States local-currency Stripe pricing complete. Linked to live USD recurring prices.')
) as seed(
  market_country,
  role,
  tier,
  cadence,
  currency,
  amount_minor,
  provider_price_ref,
  operator_notes
)
where book.product_area = 'subscriptions'
  and book.provider = 'stripe'
  and book.active = true
  and book.ends_at is null
  and book.market_country = seed.market_country
  and book.role = seed.role
  and book.tier = seed.tier
  and book.cadence = seed.cadence;
