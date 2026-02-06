-- Agent client pages for shareable shortlists.

create table if not exists public.agent_client_pages (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  agent_slug text not null,
  client_slug text not null,
  client_name text not null,
  title text null,
  client_brief text null,
  criteria jsonb not null default '{}'::jsonb,
  pinned_property_ids uuid[] null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_agent_client_pages_agent_client_slug
  on public.agent_client_pages (agent_user_id, client_slug);

create index if not exists idx_agent_client_pages_agent_user_id
  on public.agent_client_pages (agent_user_id);

create index if not exists idx_agent_client_pages_agent_slug_client_slug
  on public.agent_client_pages (agent_slug, client_slug);

create or replace function public.touch_agent_client_pages_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_client_pages_touch_updated_at on public.agent_client_pages;
create trigger agent_client_pages_touch_updated_at
before update on public.agent_client_pages
for each row execute function public.touch_agent_client_pages_updated_at();

alter table public.agent_client_pages enable row level security;

-- Public can read published client pages when storefronts are enabled.
drop policy if exists "agent_client_pages_public_select" on public.agent_client_pages;
create policy "agent_client_pages_public_select"
  on public.agent_client_pages
  for select
  using (
    published is true
    and exists (
      select 1
      from public.agent_storefronts s
      where s.user_id = agent_user_id
        and s.enabled is true
    )
    and coalesce(
      (
        select
          coalesce(
            case
              when jsonb_typeof(value) = 'object' and value ? 'enabled' then (value->>'enabled')::boolean
            end,
            case when jsonb_typeof(value) = 'boolean' then (value::text)::boolean end,
            true
          )
        from public.app_settings
        where key = 'agent_storefronts_enabled'
        limit 1
      ),
      true
    )
  );

-- Owners manage their own client pages.
drop policy if exists "agent_client_pages_owner_select" on public.agent_client_pages;
create policy "agent_client_pages_owner_select"
  on public.agent_client_pages
  for select
  using (auth.uid() = agent_user_id);

drop policy if exists "agent_client_pages_owner_insert" on public.agent_client_pages;
create policy "agent_client_pages_owner_insert"
  on public.agent_client_pages
  for insert
  with check (auth.uid() = agent_user_id);

drop policy if exists "agent_client_pages_owner_update" on public.agent_client_pages;
create policy "agent_client_pages_owner_update"
  on public.agent_client_pages
  for update
  using (auth.uid() = agent_user_id)
  with check (auth.uid() = agent_user_id);

drop policy if exists "agent_client_pages_owner_delete" on public.agent_client_pages;
create policy "agent_client_pages_owner_delete"
  on public.agent_client_pages
  for delete
  using (auth.uid() = agent_user_id);

-- Admins can read all rows.
drop policy if exists "agent_client_pages_admin_select" on public.agent_client_pages;
create policy "agent_client_pages_admin_select"
  on public.agent_client_pages
  for select
  using (public.is_admin());
