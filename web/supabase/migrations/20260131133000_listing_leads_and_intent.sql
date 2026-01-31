-- Add listing intent (rent/buy) and listing leads table.

-- Listing intent on properties.
alter table public.properties add column if not exists listing_intent text;
update public.properties set listing_intent = 'rent' where listing_intent is null;
alter table public.properties alter column listing_intent set default 'rent';
alter table public.properties alter column listing_intent set not null;
alter table public.properties drop constraint if exists properties_listing_intent_check;
alter table public.properties
  add constraint properties_listing_intent_check
  check (listing_intent in ('rent', 'buy'));

-- Leads for buy enquiries.
create table if not exists public.listing_leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid references public.message_threads (id) on delete set null,
  status text not null default 'NEW',
  intent text not null default 'BUY',
  budget_min numeric,
  budget_max numeric,
  financing_status text,
  timeline text,
  message text not null,
  message_original text,
  contact_exchange_flags jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_leads drop constraint if exists listing_leads_status_check;
alter table public.listing_leads
  add constraint listing_leads_status_check
  check (status in ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'));

alter table public.listing_leads drop constraint if exists listing_leads_intent_check;
alter table public.listing_leads
  add constraint listing_leads_intent_check
  check (intent in ('BUY', 'MAKE_OFFER', 'ASK_QUESTION'));

create index if not exists idx_listing_leads_property on public.listing_leads (property_id);
create index if not exists idx_listing_leads_owner on public.listing_leads (owner_id, created_at desc);
create index if not exists idx_listing_leads_buyer on public.listing_leads (buyer_id, created_at desc);
create index if not exists idx_listing_leads_status on public.listing_leads (status);

alter table public.listing_leads enable row level security;

drop policy if exists "listing_leads_select" on public.listing_leads;
create policy "listing_leads_select"
  on public.listing_leads
  for select
  using (
    auth.uid() = buyer_id
    or auth.uid() = owner_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "listing_leads_insert" on public.listing_leads;
create policy "listing_leads_insert"
  on public.listing_leads
  for insert
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.is_approved = true
        and p.is_active = true
    )
  );

drop policy if exists "listing_leads_update" on public.listing_leads;
create policy "listing_leads_update"
  on public.listing_leads
  for update
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
