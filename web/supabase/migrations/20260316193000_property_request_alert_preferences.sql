alter table public.profiles
  add column if not exists property_request_alerts_enabled boolean not null default true;
