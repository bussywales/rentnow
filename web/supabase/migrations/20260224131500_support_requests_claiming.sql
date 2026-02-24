-- Support request admin lifecycle fields for inbox triage

alter table public.support_requests
  add column if not exists claimed_by uuid null references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz null,
  add column if not exists resolved_at timestamptz null;

create index if not exists support_requests_claimed_by_idx
  on public.support_requests (claimed_by, created_at desc);

create index if not exists support_requests_resolved_at_idx
  on public.support_requests (resolved_at desc);
