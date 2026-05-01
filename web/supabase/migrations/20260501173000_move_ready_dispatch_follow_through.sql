alter table public.move_ready_requests
  add column if not exists awarded_provider_id uuid references public.move_ready_service_providers(id) on delete set null,
  add column if not exists awarded_at timestamptz,
  add column if not exists awarded_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;

alter table public.move_ready_requests
  drop constraint if exists move_ready_requests_status_check;

alter table public.move_ready_requests
  add constraint move_ready_requests_status_check
  check (status in ('submitted', 'matched', 'unmatched', 'awarded', 'closed_no_match', 'closed'));

alter table public.move_ready_request_leads
  add column if not exists quote_summary text;

alter table public.move_ready_request_leads
  drop constraint if exists move_ready_request_leads_routing_status_check;

alter table public.move_ready_request_leads
  add constraint move_ready_request_leads_routing_status_check
  check (routing_status in ('pending_delivery', 'sent', 'delivery_failed', 'accepted', 'declined', 'needs_more_information', 'awarded'));
