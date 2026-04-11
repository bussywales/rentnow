update public.subscription_price_book
set
  currency = 'CAD',
  provider = 'stripe',
  provider_price_ref = 'price_1TKaJfPjtZ0fKtkB7GnRxQWJ',
  updated_at = timezone('utc', now()),
  operator_notes = 'Corrected CA landlord yearly canonical Stripe ref to the final CAD recurring price.'
where product_area = 'subscriptions'
  and market_country = 'CA'
  and role = 'landlord'
  and cadence = 'yearly'
  and active = true
  and coalesce(workflow_state, 'active') = 'active';
