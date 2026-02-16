-- Shortlet booking email idempotency log.

create table if not exists public.shortlet_booking_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'host_new_booking_request',
      'tenant_booking_request_sent',
      'host_new_reservation',
      'tenant_reservation_confirmed',
      'tenant_booking_approved',
      'host_booking_approved_confirmation',
      'tenant_booking_declined',
      'tenant_booking_expired'
    )
  ),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, event_type, recipient_user_id)
);

create index if not exists shortlet_booking_notifications_booking_idx
  on public.shortlet_booking_notifications (booking_id, created_at desc);

create index if not exists shortlet_booking_notifications_recipient_idx
  on public.shortlet_booking_notifications (recipient_user_id, created_at desc);

drop trigger if exists shortlet_booking_notifications_touch_updated_at on public.shortlet_booking_notifications;
create trigger shortlet_booking_notifications_touch_updated_at
before update on public.shortlet_booking_notifications
for each row execute function public.touch_shortlet_updated_at();

alter table public.shortlet_booking_notifications enable row level security;
alter table public.shortlet_booking_notifications force row level security;

drop policy if exists "shortlet booking notifications admin read" on public.shortlet_booking_notifications;
create policy "shortlet booking notifications admin read"
  on public.shortlet_booking_notifications
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

drop policy if exists "shortlet booking notifications service write" on public.shortlet_booking_notifications;
create policy "shortlet booking notifications service write"
  on public.shortlet_booking_notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
