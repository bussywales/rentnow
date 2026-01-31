-- Property share links + support requests

create table if not exists public.property_share_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  rotated_from uuid null references public.property_share_links(id)
);

create index if not exists property_share_links_property_idx on public.property_share_links(property_id, created_at desc);
create index if not exists property_share_links_token_idx on public.property_share_links(token);
create index if not exists property_share_links_created_by_idx on public.property_share_links(created_by, created_at desc);

alter table public.property_share_links enable row level security;

-- Support requests (contact form)
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  category text not null default 'general',
  email text null,
  name text null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx on public.support_requests(created_at desc);
create index if not exists support_requests_status_idx on public.support_requests(status, created_at desc);

alter table public.support_requests enable row level security;

-- Policies
-- property_share_links

drop policy if exists "property share links select owner" on public.property_share_links;
create policy "property share links select owner" on public.property_share_links
  for select
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "property share links insert owner" on public.property_share_links;
create policy "property share links insert owner" on public.property_share_links
  for insert
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "property share links update owner" on public.property_share_links;
create policy "property share links update owner" on public.property_share_links
  for update
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "property share links admin read" on public.property_share_links;
create policy "property share links admin read" on public.property_share_links
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "property share links admin write" on public.property_share_links;
create policy "property share links admin write" on public.property_share_links
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- support_requests

drop policy if exists "support requests insert" on public.support_requests;
create policy "support requests insert" on public.support_requests
  for insert
  with check (true);

drop policy if exists "support requests admin read" on public.support_requests;
create policy "support requests admin read" on public.support_requests
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
