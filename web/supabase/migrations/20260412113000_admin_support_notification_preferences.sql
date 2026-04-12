alter table public.profiles
  add column if not exists support_request_email_enabled boolean not null default false;

alter table public.profiles
  add column if not exists support_escalation_email_enabled boolean not null default false;
