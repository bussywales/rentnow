-- Add non-sensitive location fields for picker/geocoding
alter table public.properties
  add column if not exists location_label text,
  add column if not exists location_place_id text,
  add column if not exists location_source text,
  add column if not exists location_precision text;

-- Seed flag for location picker rollout
insert into public.app_settings(key, value)
values ('enable_location_picker', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;
