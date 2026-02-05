-- Ensure agent storefronts table exists and is public-safe.

create table if not exists public.agent_storefronts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  enabled boolean not null default true,
  bio text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_agent_storefronts_user_id
  on public.agent_storefronts (user_id);

create unique index if not exists idx_agent_storefronts_slug_unique
  on public.agent_storefronts (lower(slug));

create or replace function public.touch_agent_storefronts_updated_at()
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

drop trigger if exists agent_storefronts_touch_updated_at on public.agent_storefronts;
create trigger agent_storefronts_touch_updated_at
before update on public.agent_storefronts
for each row execute function public.touch_agent_storefronts_updated_at();

alter table public.agent_storefronts enable row level security;

drop policy if exists "agent_storefronts_public_select" on public.agent_storefronts;
create policy "agent_storefronts_public_select"
  on public.agent_storefronts
  for select
  using (
    enabled is true
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

drop policy if exists "agent_storefronts_owner_select" on public.agent_storefronts;
create policy "agent_storefronts_owner_select"
  on public.agent_storefronts
  for select
  using (auth.uid() = user_id);

drop policy if exists "agent_storefronts_owner_write" on public.agent_storefronts;
create policy "agent_storefronts_owner_write"
  on public.agent_storefronts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "agent_storefronts_owner_update" on public.agent_storefronts;
create policy "agent_storefronts_owner_update"
  on public.agent_storefronts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "agent_storefronts_owner_delete" on public.agent_storefronts;
create policy "agent_storefronts_owner_delete"
  on public.agent_storefronts
  for delete
  using (auth.uid() = user_id);

drop policy if exists "agent_storefronts_admin_all" on public.agent_storefronts;
create policy "agent_storefronts_admin_all"
  on public.agent_storefronts
  for all
  using (public.is_admin())
  with check (public.is_admin());

with candidates as (
  select
    p.id as user_id,
    p.agent_storefront_enabled,
    p.agent_bio,
    nullif(btrim(p.agent_slug), '') as preferred_slug,
    lower(btrim(coalesce(p.display_name, p.full_name, p.business_name, ''))) as name_raw
  from public.profiles p
  where p.role = 'agent'
),
slugs as (
  select
    user_id,
    agent_storefront_enabled,
    agent_bio,
    preferred_slug,
    nullif(
      regexp_replace(
        regexp_replace(name_raw, '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ) as name_slug
  from candidates
),
final as (
  select
    user_id,
    coalesce(
      preferred_slug,
      case
        when name_slug is not null then name_slug || '-' || right(user_id::text, 4)
        else null
      end,
      'agent-' || right(user_id::text, 8)
    ) as slug,
    coalesce(agent_storefront_enabled, true) as enabled,
    agent_bio as bio
  from slugs
)
insert into public.agent_storefronts (user_id, slug, enabled, bio)
select user_id, slug, enabled, bio
from final
on conflict (user_id) do update
set slug = excluded.slug,
    enabled = excluded.enabled,
    bio = excluded.bio,
    updated_at = now();

create or replace function public.get_agent_storefront_public(input_slug text)
returns table (
  agent_user_id uuid,
  slug text,
  display_name text,
  avatar_url text,
  public_bio text,
  agent_storefront_enabled boolean,
  global_enabled boolean,
  role text,
  reason text,
  ok boolean
)
language sql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
  with settings as (
    select
      coalesce(
        case
          when jsonb_typeof(value) = 'object' and value ? 'enabled' then (value->>'enabled')::boolean
        end,
        case when jsonb_typeof(value) = 'boolean' then (value::text)::boolean end,
        true
      ) as global_enabled
    from public.app_settings
    where key = 'agent_storefronts_enabled'
    limit 1
  ),
  storefront as (
    select
      s.user_id,
      s.slug,
      s.enabled,
      s.bio
    from public.agent_storefronts s
    where s.slug is not null
      and lower(btrim(s.slug)) = lower(btrim(input_slug))
    limit 1
  ),
  profile as (
    select
      p.id,
      p.role,
      p.display_name,
      p.full_name,
      p.business_name,
      p.avatar_url
    from public.profiles p
    join storefront s on s.user_id = p.id
    limit 1
  )
  select
    s.user_id as agent_user_id,
    s.slug as slug,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(p.full_name), ''),
      nullif(btrim(p.business_name), ''),
      'Agent'
    ) as display_name,
    p.avatar_url,
    s.bio as public_bio,
    s.enabled as agent_storefront_enabled,
    coalesce(st.global_enabled, true) as global_enabled,
    p.role,
    case
      when coalesce(st.global_enabled, true) = false then 'GLOBAL_DISABLED'
      when s.user_id is null or p.id is null then 'NOT_FOUND'
      when p.role is distinct from 'agent' then 'NOT_AGENT'
      when s.enabled is false then 'AGENT_DISABLED'
      else 'OK'
    end as reason,
    case
      when coalesce(st.global_enabled, true) = false then false
      when s.user_id is null or p.id is null then false
      when p.role is distinct from 'agent' then false
      when s.enabled is false then false
      else true
    end as ok
  from (select 1) seed
  left join settings st on true
  left join storefront s on true
  left join profile p on true;
$$;

revoke all on function public.get_agent_storefront_public(text) from public;
grant execute on function public.get_agent_storefront_public(text) to anon, authenticated;
