alter table public.property_requests
  add column if not exists extension_count integer not null default 0,
  add column if not exists last_expiry_reminder_for_expires_at timestamptz null;

alter table public.property_requests
  drop constraint if exists property_requests_extension_count_check;

alter table public.property_requests
  add constraint property_requests_extension_count_check
  check (extension_count >= 0);
