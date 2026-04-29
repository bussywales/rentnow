-- Add a real request headline so structured location fields are not used as pseudo-titles.

alter table public.property_requests
  add column if not exists title text null;

alter table public.property_requests
  drop constraint if exists property_requests_title_length_check;

alter table public.property_requests
  add constraint property_requests_title_length_check
  check (
    title is null
    or char_length(btrim(title)) between 3 and 120
  );

comment on column public.property_requests.title is
  'Human-readable request headline. City, area, and location_text remain structured location fields.';
