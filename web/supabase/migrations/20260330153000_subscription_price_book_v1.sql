create table if not exists public.subscription_price_book (
  id uuid primary key default gen_random_uuid(),
  product_area text not null default 'subscriptions',
  role text not null,
  tier text not null,
  cadence text not null,
  market_country text not null,
  currency text not null,
  amount_minor integer not null,
  provider text not null,
  provider_price_ref text,
  active boolean not null default true,
  fallback_eligible boolean not null default false,
  effective_at timestamptz not null default now(),
  ends_at timestamptz,
  display_order integer not null default 0,
  badge text,
  operator_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint subscription_price_book_product_area_check check (product_area = 'subscriptions'),
  constraint subscription_price_book_role_check check (role in ('tenant', 'landlord', 'agent')),
  constraint subscription_price_book_tier_check check (tier in ('free', 'starter', 'pro', 'tenant_pro')),
  constraint subscription_price_book_cadence_check check (cadence in ('monthly', 'yearly')),
  constraint subscription_price_book_country_check check (market_country ~ '^[A-Z]{2}$'),
  constraint subscription_price_book_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_price_book_provider_check check (provider in ('stripe', 'paystack', 'flutterwave')),
  constraint subscription_price_book_amount_check check (amount_minor >= 0),
  constraint subscription_price_book_role_tier_check check (
    (role = 'tenant' and tier in ('free', 'tenant_pro'))
    or (role in ('landlord', 'agent') and tier in ('free', 'starter', 'pro'))
  )
);

create unique index if not exists subscription_price_book_active_current_unique
  on public.subscription_price_book (product_area, role, tier, cadence, market_country)
  where active = true and ends_at is null;

create index if not exists subscription_price_book_market_idx
  on public.subscription_price_book (market_country, role, cadence, active);

create index if not exists subscription_price_book_provider_idx
  on public.subscription_price_book (provider, active, fallback_eligible);

alter table public.subscription_price_book enable row level security;
alter table public.subscription_price_book force row level security;

drop policy if exists "subscription price book admin read" on public.subscription_price_book;
create policy "subscription price book admin read" on public.subscription_price_book
  for select
  using (public.is_admin());

drop policy if exists "subscription price book admin write" on public.subscription_price_book;
create policy "subscription price book admin write" on public.subscription_price_book
  for all
  using (public.is_admin())
  with check (public.is_admin());

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
values
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000001',
    'subscriptions',
    'tenant',
    'tenant_pro',
    'monthly',
    'GB',
    'GBP',
    999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    10,
    null,
    'Official UK pricing truth. Runtime amount currently aligns, but canonical Stripe provider ref still needs explicit linkage.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000002',
    'subscriptions',
    'tenant',
    'tenant_pro',
    'yearly',
    'GB',
    'GBP',
    8999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    11,
    null,
    'Official UK pricing truth. Requires a new Stripe recurring price before checkout can align safely.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000003',
    'subscriptions',
    'landlord',
    'pro',
    'monthly',
    'GB',
    'GBP',
    1999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    20,
    null,
    'Official UK pricing truth. Runtime amount currently aligns, but canonical Stripe provider ref still needs explicit linkage.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000004',
    'subscriptions',
    'landlord',
    'pro',
    'yearly',
    'GB',
    'GBP',
    18999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    21,
    null,
    'Official UK pricing truth. Requires a new Stripe recurring price before checkout can align safely.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000005',
    'subscriptions',
    'agent',
    'pro',
    'monthly',
    'GB',
    'GBP',
    3999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    30,
    null,
    'Official UK pricing truth. Requires a new Stripe recurring price before checkout can align safely.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000006',
    'subscriptions',
    'agent',
    'pro',
    'yearly',
    'GB',
    'GBP',
    38999,
    'stripe',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    31,
    null,
    'Official UK pricing truth. Requires a new Stripe recurring price before checkout can align safely.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000007',
    'subscriptions',
    'tenant',
    'tenant_pro',
    'monthly',
    'NG',
    'NGN',
    90000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    40,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000008',
    'subscriptions',
    'tenant',
    'tenant_pro',
    'yearly',
    'NG',
    'NGN',
    900000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    41,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000009',
    'subscriptions',
    'landlord',
    'pro',
    'monthly',
    'NG',
    'NGN',
    290000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    50,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000010',
    'subscriptions',
    'landlord',
    'pro',
    'yearly',
    'NG',
    'NGN',
    2900000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    51,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000011',
    'subscriptions',
    'agent',
    'pro',
    'monthly',
    'NG',
    'NGN',
    490000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    60,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  ),
  (
    '7c9c42b0-a9d6-4f6a-8d11-000000000012',
    'subscriptions',
    'agent',
    'pro',
    'yearly',
    'NG',
    'NGN',
    4900000,
    'paystack',
    null,
    true,
    false,
    '2026-03-30T00:00:00Z',
    61,
    null,
    'Current Nigeria runtime value carried into the canonical table as groundwork. Provider ref linkage comes later.'
  )
on conflict (id) do update set
  amount_minor = excluded.amount_minor,
  provider = excluded.provider,
  provider_price_ref = excluded.provider_price_ref,
  active = excluded.active,
  fallback_eligible = excluded.fallback_eligible,
  effective_at = excluded.effective_at,
  display_order = excluded.display_order,
  badge = excluded.badge,
  operator_notes = excluded.operator_notes,
  updated_at = now();
