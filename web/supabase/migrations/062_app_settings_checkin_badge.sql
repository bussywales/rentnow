-- App setting toggle for tenant-visible check-in badge.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('show_tenant_checkin_badge', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;
