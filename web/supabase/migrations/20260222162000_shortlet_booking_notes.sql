-- Tenant/host append-only booking notes for post-booking coordination.

create table if not exists public.shortlet_booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant', 'host')),
  topic text not null check (topic in ('check_in', 'question', 'arrival_time', 'other')),
  message text not null check (char_length(trim(message)) between 2 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists shortlet_booking_notes_booking_created_idx
  on public.shortlet_booking_notes (booking_id, created_at desc);

create index if not exists shortlet_booking_notes_author_created_idx
  on public.shortlet_booking_notes (author_user_id, created_at desc);

alter table public.shortlet_booking_notes enable row level security;
alter table public.shortlet_booking_notes force row level security;

drop policy if exists "shortlet booking notes tenant read own" on public.shortlet_booking_notes;
create policy "shortlet booking notes tenant read own"
  on public.shortlet_booking_notes
  for select
  using (
    auth.uid() = author_user_id
    or exists (
      select 1
      from public.shortlet_bookings b
      where b.id = shortlet_booking_notes.booking_id
        and b.guest_user_id = auth.uid()
    )
  );

drop policy if exists "shortlet booking notes tenant insert own" on public.shortlet_booking_notes;
create policy "shortlet booking notes tenant insert own"
  on public.shortlet_booking_notes
  for insert
  with check (
    auth.uid() = author_user_id
    and role = 'tenant'
    and exists (
      select 1
      from public.shortlet_bookings b
      where b.id = shortlet_booking_notes.booking_id
        and b.guest_user_id = auth.uid()
    )
  );

drop policy if exists "shortlet booking notes host read own listings" on public.shortlet_booking_notes;
create policy "shortlet booking notes host read own listings"
  on public.shortlet_booking_notes
  for select
  using (
    exists (
      select 1
      from public.shortlet_bookings b
      where b.id = shortlet_booking_notes.booking_id
        and b.host_user_id = auth.uid()
    )
  );

drop policy if exists "shortlet booking notes host insert own listings" on public.shortlet_booking_notes;
create policy "shortlet booking notes host insert own listings"
  on public.shortlet_booking_notes
  for insert
  with check (
    auth.uid() = author_user_id
    and role = 'host'
    and exists (
      select 1
      from public.shortlet_bookings b
      where b.id = shortlet_booking_notes.booking_id
        and b.host_user_id = auth.uid()
    )
  );

drop policy if exists "shortlet booking notes admin read" on public.shortlet_booking_notes;
create policy "shortlet booking notes admin read"
  on public.shortlet_booking_notes
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

drop policy if exists "shortlet booking notes service write" on public.shortlet_booking_notes;
create policy "shortlet booking notes service write"
  on public.shortlet_booking_notes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
