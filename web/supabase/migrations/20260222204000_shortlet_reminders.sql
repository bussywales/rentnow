-- Shortlet reminder idempotency log.

create table if not exists public.shortlet_reminder_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  event_key text not null check (
    event_key in (
      'checkin_48h',
      'checkin_24h',
      'checkin_3h',
      'checkout_morning',
      'manual_checkin_shared'
    )
  ),
  sent_at timestamptz not null default now(),
  unique (booking_id, event_key)
);

create index if not exists shortlet_reminder_events_booking_idx
  on public.shortlet_reminder_events (booking_id, sent_at desc);

alter table public.shortlet_reminder_events enable row level security;
alter table public.shortlet_reminder_events force row level security;

drop policy if exists "shortlet reminder events admin read" on public.shortlet_reminder_events;
create policy "shortlet reminder events admin read"
  on public.shortlet_reminder_events
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "shortlet reminder events service write" on public.shortlet_reminder_events;
create policy "shortlet reminder events service write"
  on public.shortlet_reminder_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
