create table if not exists public.move_ready_service_providers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  verification_state text not null default 'pending' check (verification_state in ('pending', 'approved', 'rejected')),
  provider_status text not null default 'active' check (provider_status in ('active', 'paused')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.move_ready_provider_categories (
  provider_id uuid not null references public.move_ready_service_providers(id) on delete cascade,
  category text not null check (category in ('end_of_tenancy_cleaning', 'fumigation_pest_control', 'minor_repairs_handyman')),
  created_at timestamptz not null default now(),
  primary key (provider_id, category)
);

create table if not exists public.move_ready_provider_areas (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.move_ready_service_providers(id) on delete cascade,
  market_code text not null,
  city text,
  area text,
  created_at timestamptz not null default now()
);

create unique index if not exists move_ready_provider_areas_unique_idx
  on public.move_ready_provider_areas (
    provider_id,
    market_code,
    coalesce(lower(city), ''),
    coalesce(lower(area), '')
  );

create table if not exists public.move_ready_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  requester_role text not null check (requester_role in ('landlord', 'agent')),
  requester_name text,
  requester_email text,
  requester_phone text,
  contact_preference text check (contact_preference in ('phone', 'email')),
  property_id uuid references public.properties(id) on delete set null,
  category text not null check (category in ('end_of_tenancy_cleaning', 'fumigation_pest_control', 'minor_repairs_handyman')),
  entrypoint_source text not null,
  market_code text not null,
  city text,
  area text,
  context_notes text not null,
  preferred_timing_text text,
  status text not null default 'submitted' check (status in ('submitted', 'matched', 'unmatched', 'closed')),
  matched_provider_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.move_ready_request_leads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.move_ready_requests(id) on delete cascade,
  provider_id uuid not null references public.move_ready_service_providers(id) on delete cascade,
  response_token text not null unique,
  routing_status text not null default 'pending_delivery' check (routing_status in ('pending_delivery', 'sent', 'delivery_failed', 'accepted', 'declined')),
  response_note text,
  last_error text,
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index if not exists move_ready_service_providers_status_idx
  on public.move_ready_service_providers (verification_state, provider_status, created_at desc);

create index if not exists move_ready_requests_owner_idx
  on public.move_ready_requests (requester_user_id, created_at desc);

create index if not exists move_ready_requests_status_idx
  on public.move_ready_requests (status, created_at desc);

create index if not exists move_ready_request_leads_request_idx
  on public.move_ready_request_leads (request_id, created_at desc);

create index if not exists move_ready_request_leads_provider_idx
  on public.move_ready_request_leads (provider_id, created_at desc);

alter table public.move_ready_service_providers enable row level security;
alter table public.move_ready_provider_categories enable row level security;
alter table public.move_ready_provider_areas enable row level security;
alter table public.move_ready_requests enable row level security;
alter table public.move_ready_request_leads enable row level security;
