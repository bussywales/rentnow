-- Phase 4: referral cashout ops hardening (append-only audit + user-facing notifications).
-- Extends existing referral cashout requests; no parallel payout request table.

create table if not exists public.referral_cashout_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.referral_cashout_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  previous_status text,
  new_status text,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_cashout_audit_request_created
  on public.referral_cashout_audit (request_id, created_at desc);

create index if not exists idx_referral_cashout_audit_actor_created
  on public.referral_cashout_audit (actor_id, created_at desc);

create table if not exists public.referral_cashout_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.referral_cashout_requests(id) on delete cascade,
  type text not null check (type in ('approved', 'rejected')),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_referral_cashout_notifications_user_created
  on public.referral_cashout_notifications (user_id, created_at desc);

create index if not exists idx_referral_cashout_notifications_request
  on public.referral_cashout_notifications (request_id);

alter table public.referral_cashout_audit enable row level security;
alter table public.referral_cashout_audit force row level security;

alter table public.referral_cashout_notifications enable row level security;
alter table public.referral_cashout_notifications force row level security;

drop policy if exists "referral cashout audit admin read" on public.referral_cashout_audit;
create policy "referral cashout audit admin read" on public.referral_cashout_audit
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "referral cashout audit admin insert" on public.referral_cashout_audit;
create policy "referral cashout audit admin insert" on public.referral_cashout_audit
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "referral cashout audit service write" on public.referral_cashout_audit;
create policy "referral cashout audit service write" on public.referral_cashout_audit
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "referral cashout notifications owner select" on public.referral_cashout_notifications;
create policy "referral cashout notifications owner select" on public.referral_cashout_notifications
  for select
  using (user_id = auth.uid());

drop policy if exists "referral cashout notifications owner update" on public.referral_cashout_notifications;
create policy "referral cashout notifications owner update" on public.referral_cashout_notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "referral cashout notifications admin insert" on public.referral_cashout_notifications;
create policy "referral cashout notifications admin insert" on public.referral_cashout_notifications
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "referral cashout notifications service write" on public.referral_cashout_notifications;
create policy "referral cashout notifications service write" on public.referral_cashout_notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
