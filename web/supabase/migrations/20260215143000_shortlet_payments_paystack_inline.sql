-- Shortlet Paystack inline checkout (Option A): booking first, payment second.

alter table public.shortlet_bookings
  add column if not exists total_price_minor bigint generated always as (total_amount_minor::bigint) stored;

create table if not exists public.shortlet_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  provider text not null default 'paystack',
  status text not null,
  currency text not null default 'NGN',
  amount_minor bigint not null,
  reference text not null,
  access_code text,
  authorization_code text,
  customer_code text,
  paid_at timestamptz,
  captured_at timestamptz,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_payments_provider_chk check (provider in ('paystack')),
  constraint shortlet_payments_status_chk check (
    status in ('initiated', 'authorised', 'captured', 'voided', 'failed', 'refunded')
  ),
  constraint shortlet_payments_currency_chk check (currency = 'NGN'),
  constraint shortlet_payments_amount_chk check (amount_minor > 0),
  constraint shortlet_payments_booking_unique unique (booking_id),
  constraint shortlet_payments_reference_unique unique (reference)
);

create index if not exists shortlet_payments_status_created_idx
  on public.shortlet_payments (status, created_at desc);

create index if not exists shortlet_payments_provider_created_idx
  on public.shortlet_payments (provider, created_at desc);

drop trigger if exists shortlet_payments_touch_updated_at on public.shortlet_payments;
create trigger shortlet_payments_touch_updated_at
before update on public.shortlet_payments
for each row execute function public.touch_shortlet_updated_at();

alter table public.shortlet_payments enable row level security;
alter table public.shortlet_payments force row level security;

drop policy if exists "shortlet payments read own" on public.shortlet_payments;
create policy "shortlet payments read own"
  on public.shortlet_payments
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
    or exists (
      select 1
      from public.shortlet_bookings b
      where b.id = shortlet_payments.booking_id
        and (
          b.guest_user_id = auth.uid()
          or b.host_user_id = auth.uid()
        )
    )
  );

drop policy if exists "shortlet payments service write" on public.shortlet_payments;
create policy "shortlet payments service write"
  on public.shortlet_payments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
