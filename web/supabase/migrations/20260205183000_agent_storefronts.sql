-- Agent storefront toggles and profile metadata.

alter table public.profiles
  add column if not exists agent_storefront_enabled boolean not null default true,
  add column if not exists agent_slug text,
  add column if not exists agent_bio text;

create unique index if not exists idx_profiles_agent_slug_unique
  on public.profiles (lower(agent_slug))
  where agent_slug is not null;

insert into public.app_settings (key, value)
values ('agent_storefronts_enabled', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;
