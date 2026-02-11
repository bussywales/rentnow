-- Keep old advertiser slugs redirectable after updates.

create table if not exists public.profile_slug_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  changed_at timestamptz not null default now(),
  constraint profile_slug_history_old_slug_not_blank_chk check (nullif(btrim(old_slug), '') is not null),
  constraint profile_slug_history_new_slug_not_blank_chk check (nullif(btrim(new_slug), '') is not null)
);

create unique index if not exists profile_slug_history_old_slug_lower_unique_idx
  on public.profile_slug_history (lower(old_slug));

create index if not exists profile_slug_history_profile_id_changed_at_idx
  on public.profile_slug_history (profile_id, changed_at desc);

alter table public.profile_slug_history enable row level security;
alter table public.profile_slug_history force row level security;

drop policy if exists "profile_slug_history_public_select" on public.profile_slug_history;
create policy "profile_slug_history_public_select"
  on public.profile_slug_history
  for select
  using (true);

drop policy if exists "profile_slug_history_owner_insert" on public.profile_slug_history;
create policy "profile_slug_history_owner_insert"
  on public.profile_slug_history
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists "profile_slug_history_admin_insert" on public.profile_slug_history;
create policy "profile_slug_history_admin_insert"
  on public.profile_slug_history
  for insert
  with check (public.is_admin());

drop policy if exists "profile_slug_history_service_all" on public.profile_slug_history;
create policy "profile_slug_history_service_all"
  on public.profile_slug_history
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
