-- Shortlet payments reconcile metadata and verification tracking.

alter table public.shortlet_payments
  add column if not exists last_verified_at timestamptz,
  add column if not exists verify_attempts integer not null default 0,
  add column if not exists needs_reconcile boolean not null default false,
  add column if not exists reconcile_reason text,
  add column if not exists reconcile_locked_until timestamptz,
  add column if not exists provider_event_id text,
  add column if not exists provider_tx_id text,
  add column if not exists confirmed_at timestamptz;

alter table public.shortlet_payments
  drop constraint if exists shortlet_payments_verify_attempts_chk;

alter table public.shortlet_payments
  add constraint shortlet_payments_verify_attempts_chk
  check (verify_attempts >= 0);

create index if not exists shortlet_payments_reconcile_idx
  on public.shortlet_payments (needs_reconcile, status, updated_at desc);

create index if not exists shortlet_payments_reconcile_lock_idx
  on public.shortlet_payments (reconcile_locked_until);

update public.shortlet_payments
set confirmed_at = coalesce(confirmed_at, updated_at)
where status = 'succeeded';
