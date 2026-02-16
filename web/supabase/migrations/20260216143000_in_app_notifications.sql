-- In-app notification feed for booking activity.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text not null,
  is_read boolean not null default false,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own"
  on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications service insert" on public.notifications;
create policy "notifications service insert"
  on public.notifications
  for insert
  with check (auth.role() = 'service_role');
