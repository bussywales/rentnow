-- Shortlet booking race-safety + pilot payout ops metadata.

create extension if not exists btree_gist;

alter table public.shortlet_bookings
  drop constraint if exists shortlet_bookings_no_overlap;

alter table public.shortlet_bookings
  add constraint shortlet_bookings_no_overlap
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

alter table public.shortlet_payouts
  add column if not exists paid_method text,
  add column if not exists paid_reference text,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;

update public.shortlet_payouts
set paid_reference = coalesce(paid_reference, paid_ref)
where paid_ref is not null;

create table if not exists public.shortlet_payout_audit (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.shortlet_payouts(id) on delete cascade,
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shortlet_payout_audit_payout_idx
  on public.shortlet_payout_audit (payout_id, created_at desc);

create index if not exists shortlet_payout_audit_booking_idx
  on public.shortlet_payout_audit (booking_id, created_at desc);

alter table public.shortlet_payout_audit enable row level security;
alter table public.shortlet_payout_audit force row level security;

drop policy if exists "shortlet payout audit admin read" on public.shortlet_payout_audit;
create policy "shortlet payout audit admin read"
  on public.shortlet_payout_audit
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "shortlet payout audit admin insert" on public.shortlet_payout_audit;
create policy "shortlet payout audit admin insert"
  on public.shortlet_payout_audit
  for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
    )
  );
