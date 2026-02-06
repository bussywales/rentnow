-- Allow legacy slug lookups based on agent display name and redirect to stored slug.

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
  profile_from_storefront as (
    select
      p.id,
      p.role,
      p.display_name,
      p.full_name,
      p.business_name,
      p.avatar_url,
      p.agent_slug,
      p.agent_storefront_enabled,
      p.agent_bio
    from public.profiles p
    join storefront s on s.user_id = p.id
    limit 1
  ),
  profile_direct as (
    select
      p.id,
      p.role,
      p.display_name,
      p.full_name,
      p.business_name,
      p.avatar_url,
      p.agent_slug,
      p.agent_storefront_enabled,
      p.agent_bio
    from public.profiles p
    where p.agent_slug is not null
      and lower(btrim(p.agent_slug)) = lower(btrim(input_slug))
    limit 1
  ),
  legacy_profile as (
    select
      p.id,
      p.role,
      p.display_name,
      p.full_name,
      p.business_name,
      p.avatar_url,
      p.agent_slug,
      p.agent_storefront_enabled,
      p.agent_bio
    from public.profiles p
    where p.agent_slug is not null
      and p.role = 'agent'
      and regexp_replace(
        regexp_replace(lower(coalesce(p.display_name, p.full_name, p.business_name, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ) = lower(btrim(input_slug))
    limit 1
  ),
  resolved as (
    select
      coalesce(ps.id, pd.id, pl.id) as id,
      coalesce(ps.role, pd.role, pl.role) as role,
      coalesce(ps.display_name, pd.display_name, pl.display_name) as display_name,
      coalesce(ps.full_name, pd.full_name, pl.full_name) as full_name,
      coalesce(ps.business_name, pd.business_name, pl.business_name) as business_name,
      coalesce(ps.avatar_url, pd.avatar_url, pl.avatar_url) as avatar_url,
      coalesce(s.slug, ps.agent_slug, pd.agent_slug, pl.agent_slug) as slug,
      coalesce(s.enabled, ps.agent_storefront_enabled, pd.agent_storefront_enabled, pl.agent_storefront_enabled, true) as enabled,
      coalesce(s.bio, ps.agent_bio, pd.agent_bio, pl.agent_bio) as bio
    from storefront s
    full join profile_from_storefront ps on true
    full join profile_direct pd on true
    full join legacy_profile pl on true
  )
  select
    r.id as agent_user_id,
    r.slug as slug,
    coalesce(
      nullif(btrim(r.display_name), ''),
      nullif(btrim(r.full_name), ''),
      nullif(btrim(r.business_name), ''),
      'Agent'
    ) as display_name,
    r.avatar_url,
    r.bio as public_bio,
    r.enabled as agent_storefront_enabled,
    coalesce(st.global_enabled, true) as global_enabled,
    r.role,
    case
      when coalesce(st.global_enabled, true) = false then 'GLOBAL_DISABLED'
      when r.id is null then 'NOT_FOUND'
      when r.role is distinct from 'agent' then 'NOT_AGENT'
      when r.enabled is false then 'AGENT_DISABLED'
      else 'OK'
    end as reason,
    case
      when coalesce(st.global_enabled, true) = false then false
      when r.id is null then false
      when r.role is distinct from 'agent' then false
      when r.enabled is false then false
      else true
    end as ok
  from (select 1) seed
  left join settings st on true
  left join resolved r on true;
$$;

revoke all on function public.get_agent_storefront_public(text) from public;
grant execute on function public.get_agent_storefront_public(text) to anon, authenticated;
