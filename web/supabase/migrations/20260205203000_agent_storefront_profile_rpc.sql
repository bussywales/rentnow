-- Public agent storefront profile fetch (safe fields only)
create or replace function public.get_agent_storefront_profile(input_slug text)
returns table (
  id uuid,
  role text,
  display_name text,
  full_name text,
  business_name text,
  avatar_url text,
  agent_bio text,
  agent_slug text,
  agent_storefront_enabled boolean
)
language sql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
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
  where p.role = 'agent'
    and p.agent_slug is not null
    and lower(btrim(p.agent_slug)) = lower(btrim(input_slug))
  limit 1;
$$;

revoke all on function public.get_agent_storefront_profile(text) from public;
grant execute on function public.get_agent_storefront_profile(text) to anon, authenticated;
