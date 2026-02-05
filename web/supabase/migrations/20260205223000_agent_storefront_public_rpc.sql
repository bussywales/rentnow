-- Public agent storefront lookup (safe fields only)
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
  profile as (
    select
      p.id,
      p.role,
      p.display_name,
      p.full_name,
      p.business_name,
      p.avatar_url,
      p.agent_bio,
      p.agent_slug,
      p.agent_storefront_enabled
    from public.profiles p
    where p.agent_slug is not null
      and lower(btrim(p.agent_slug)) = lower(btrim(input_slug))
    limit 1
  )
  select
    p.id as agent_user_id,
    p.agent_slug as slug,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(p.full_name), ''),
      nullif(btrim(p.business_name), ''),
      'Agent'
    ) as display_name,
    p.avatar_url,
    p.agent_bio as public_bio,
    p.agent_storefront_enabled,
    coalesce(s.global_enabled, true) as global_enabled,
    p.role,
    case
      when coalesce(s.global_enabled, true) = false then 'GLOBAL_DISABLED'
      when p.id is null then 'NOT_FOUND'
      when p.role is distinct from 'agent' then 'NOT_AGENT'
      when p.agent_storefront_enabled is false then 'AGENT_DISABLED'
      else 'OK'
    end as reason,
    case
      when coalesce(s.global_enabled, true) = false then false
      when p.id is null then false
      when p.role is distinct from 'agent' then false
      when p.agent_storefront_enabled is false then false
      else true
    end as ok
  from (select 1) seed
  left join settings s on true
  left join profile p on true;
$$;

revoke all on function public.get_agent_storefront_public(text) from public;
grant execute on function public.get_agent_storefront_public(text) to anon, authenticated;
