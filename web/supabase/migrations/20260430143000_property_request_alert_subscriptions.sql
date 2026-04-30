create table if not exists public.property_request_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  market_code text not null,
  intent text null,
  property_type text null,
  city text null,
  bedrooms_min integer null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint property_request_alert_subscriptions_role_check check (role in ('agent', 'landlord')),
  constraint property_request_alert_subscriptions_market_check check (market_code ~ '^[A-Z]{2}$'),
  constraint property_request_alert_subscriptions_intent_check check (
    intent is null or intent in ('rent', 'buy', 'shortlet')
  ),
  constraint property_request_alert_subscriptions_city_len_check check (
    city is null or char_length(trim(city)) between 1 and 80
  ),
  constraint property_request_alert_subscriptions_property_type_len_check check (
    property_type is null or char_length(trim(property_type)) between 1 and 64
  ),
  constraint property_request_alert_subscriptions_bedrooms_min_check check (
    bedrooms_min is null or (bedrooms_min >= 0 and bedrooms_min <= 20)
  )
);

create index if not exists property_request_alert_subscriptions_user_idx
  on public.property_request_alert_subscriptions (user_id, created_at desc);

create index if not exists property_request_alert_subscriptions_active_match_idx
  on public.property_request_alert_subscriptions (
    is_active,
    market_code,
    role,
    intent,
    property_type
  );

create index if not exists property_request_alert_subscriptions_city_idx
  on public.property_request_alert_subscriptions (lower(city))
  where city is not null;

create table if not exists public.property_request_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.property_request_alert_subscriptions(id) on delete cascade,
  request_id uuid not null references public.property_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'email',
  delivery_status text not null default 'sent',
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint property_request_alert_deliveries_channel_check check (channel in ('email')),
  constraint property_request_alert_deliveries_status_check check (delivery_status in ('sent', 'failed')),
  constraint property_request_alert_deliveries_unique unique (subscription_id, request_id, channel)
);

create index if not exists property_request_alert_deliveries_request_idx
  on public.property_request_alert_deliveries (request_id, sent_at desc);

create index if not exists property_request_alert_deliveries_user_idx
  on public.property_request_alert_deliveries (user_id, sent_at desc);

create or replace function public.touch_property_request_alert_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists property_request_alert_subscriptions_touch_updated_at on public.property_request_alert_subscriptions;
create trigger property_request_alert_subscriptions_touch_updated_at
before update on public.property_request_alert_subscriptions
for each row execute function public.touch_property_request_alert_subscriptions_updated_at();

alter table public.property_request_alert_subscriptions enable row level security;
alter table public.property_request_alert_subscriptions force row level security;
alter table public.property_request_alert_deliveries enable row level security;
alter table public.property_request_alert_deliveries force row level security;

drop policy if exists "property request alert subscriptions owner select" on public.property_request_alert_subscriptions;
create policy "property request alert subscriptions owner select"
  on public.property_request_alert_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "property request alert subscriptions owner insert" on public.property_request_alert_subscriptions;
create policy "property request alert subscriptions owner insert"
  on public.property_request_alert_subscriptions
  for insert
  with check (
    auth.uid() = user_id
    and role in ('agent', 'landlord')
  );

drop policy if exists "property request alert subscriptions owner update" on public.property_request_alert_subscriptions;
create policy "property request alert subscriptions owner update"
  on public.property_request_alert_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and role in ('agent', 'landlord')
  );

drop policy if exists "property request alert subscriptions admin select" on public.property_request_alert_subscriptions;
create policy "property request alert subscriptions admin select"
  on public.property_request_alert_subscriptions
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "property request alert subscriptions service write" on public.property_request_alert_subscriptions;
create policy "property request alert subscriptions service write"
  on public.property_request_alert_subscriptions
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "property request alert deliveries owner select" on public.property_request_alert_deliveries;
create policy "property request alert deliveries owner select"
  on public.property_request_alert_deliveries
  for select
  using (auth.uid() = user_id);

drop policy if exists "property request alert deliveries admin select" on public.property_request_alert_deliveries;
create policy "property request alert deliveries admin select"
  on public.property_request_alert_deliveries
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "property request alert deliveries service write" on public.property_request_alert_deliveries;
create policy "property request alert deliveries service write"
  on public.property_request_alert_deliveries
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

