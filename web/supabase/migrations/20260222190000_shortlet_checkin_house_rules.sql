-- Add host-managed check-in instructions and house-rules fields for shortlet settings.

alter table public.shortlet_settings
  add column if not exists checkin_instructions text,
  add column if not exists checkin_window_start time,
  add column if not exists checkin_window_end time,
  add column if not exists checkout_time time,
  add column if not exists access_method text,
  add column if not exists access_code_hint text,
  add column if not exists parking_info text,
  add column if not exists wifi_info text,
  add column if not exists house_rules text,
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time,
  add column if not exists pets_allowed boolean,
  add column if not exists smoking_allowed boolean,
  add column if not exists parties_allowed boolean,
  add column if not exists max_guests_override integer,
  add column if not exists emergency_notes text;

alter table public.shortlet_settings
  drop constraint if exists shortlet_settings_max_guests_override_chk;

alter table public.shortlet_settings
  add constraint shortlet_settings_max_guests_override_chk
  check (max_guests_override is null or max_guests_override >= 1);
