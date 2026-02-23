-- Add metadata payload support for AI escalation context

alter table public.support_requests
  add column if not exists metadata jsonb not null default '{}'::jsonb;

