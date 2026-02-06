-- Agent contact leads captured from public storefronts.

create table if not exists public.agent_leads (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.profiles (id) on delete cascade,
  agent_slug text,
  status text not null default 'NEW',
  name text,
  email text,
  phone text,
  message text not null,
  source text,
  source_url text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.agent_leads drop constraint if exists agent_leads_status_check;
alter table public.agent_leads
  add constraint agent_leads_status_check
  check (status in ('NEW', 'CONTACTED', 'CLOSED'));

create index if not exists idx_agent_leads_agent_created_at
  on public.agent_leads (agent_user_id, created_at desc);

create index if not exists idx_agent_leads_ip_created_at
  on public.agent_leads (ip_address, created_at desc);

alter table public.agent_leads enable row level security;

-- Owners/admins can read their agent leads.
drop policy if exists "agent_leads_select_owner" on public.agent_leads;
create policy "agent_leads_select_owner"
  on public.agent_leads
  for select
  using (
    auth.uid() = agent_user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
