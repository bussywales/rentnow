-- Add normalized location fields (backward compatible)
alter table if exists public.properties
  add column if not exists country_code text,
  add column if not exists admin_area_1 text,
  add column if not exists admin_area_2 text,
  add column if not exists postal_code text;

-- Optional composite index to assist lookups; safe if columns are null
create index if not exists idx_properties_location_normalized
  on public.properties (country_code, admin_area_1, city);
