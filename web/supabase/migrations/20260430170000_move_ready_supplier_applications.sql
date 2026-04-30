alter table public.move_ready_service_providers
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists verification_reference text,
  add column if not exists admin_notes text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null;

create index if not exists move_ready_service_providers_email_idx
  on public.move_ready_service_providers (lower(email));

update public.move_ready_service_providers
set
  approved_at = coalesce(approved_at, created_at)
where verification_state = 'approved'
  and provider_status = 'active';

update public.move_ready_service_providers
set
  suspended_at = coalesce(suspended_at, updated_at, created_at)
where verification_state = 'approved'
  and provider_status = 'paused';

update public.move_ready_service_providers
set
  rejected_at = coalesce(rejected_at, updated_at, created_at)
where verification_state = 'rejected';
