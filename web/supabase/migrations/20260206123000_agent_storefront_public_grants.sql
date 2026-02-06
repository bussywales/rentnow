-- Ensure public RPC has explicit grants for anon/auth and stable search_path.

alter function public.get_agent_storefront_public(text) security definer;
alter function public.get_agent_storefront_public(text) set search_path = public, pg_catalog;

revoke all on function public.get_agent_storefront_public(text) from public;
grant execute on function public.get_agent_storefront_public(text) to anon, authenticated;
