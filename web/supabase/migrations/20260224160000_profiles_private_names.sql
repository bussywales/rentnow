-- Private profile identity fields for internal/account use.
-- These are not intended for public profile surfaces.

alter table public.profiles
  add column if not exists first_name text null,
  add column if not exists last_name text null;
