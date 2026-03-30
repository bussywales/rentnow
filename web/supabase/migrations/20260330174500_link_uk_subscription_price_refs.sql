update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlYzPjtZ0fKtkBRTYNfytj',
  operator_notes = 'Official UK tenant monthly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000001';

update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlZlPjtZ0fKtkB8WaYpy35',
  operator_notes = 'Official UK tenant yearly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000002';

update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlc5PjtZ0fKtkB2ZUZqEBC',
  operator_notes = 'Official UK landlord monthly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000003';

update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlcXPjtZ0fKtkBVvXmnte6',
  operator_notes = 'Official UK landlord yearly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000004';

update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlacPjtZ0fKtkB598sPlfN',
  operator_notes = 'Official UK agent monthly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000005';

update public.subscription_price_book
set
  provider_price_ref = 'price_1TGlb0PjtZ0fKtkBqgZX4RU1',
  operator_notes = 'Official UK agent yearly Stripe recurring price linked on 2026-03-30.',
  updated_at = timezone('utc'::text, now())
where id = '7c9c42b0-a9d6-4f6a-8d11-000000000006';
