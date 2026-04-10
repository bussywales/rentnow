update public.subscription_price_book
set
  badge = 'Blocked',
  operator_notes = case
    when market_country = 'CA' then 'Blocked until real CAD recurring Stripe prices are created and linked for Canada. Current GBP-backed rows remain only for historical reconciliation and operator visibility.'
    when market_country = 'US' then 'Blocked until real USD recurring Stripe prices are created and linked for the United States. Current GBP-backed rows remain only for historical reconciliation and operator visibility.'
    else operator_notes
  end,
  updated_at = '2026-04-09T17:30:00Z'::timestamptz,
  updated_by = null
where product_area = 'subscriptions'
  and provider = 'stripe'
  and active = true
  and ends_at is null
  and market_country in ('CA', 'US');
