-- Tenant notification preferences for saved-search push alerts (instant/daily + quiet hours).

create table if not exists public.tenant_notification_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  saved_search_push_enabled boolean not null default true,
  saved_search_push_mode text not null default 'instant',
  quiet_hours_start text null,
  quiet_hours_end text null,
  timezone text not null default 'Europe/London',
  last_saved_search_push_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_notification_prefs_push_mode_chk
    check (saved_search_push_mode in ('instant', 'daily')),
  constraint tenant_notification_prefs_quiet_window_pair_chk
    check (
      (quiet_hours_start is null and quiet_hours_end is null)
      or (quiet_hours_start is not null and quiet_hours_end is not null)
    )
);

create index if not exists idx_tenant_notification_prefs_updated_at
  on public.tenant_notification_prefs (updated_at desc);

alter table public.tenant_notification_prefs enable row level security;
alter table public.tenant_notification_prefs force row level security;

drop policy if exists "tenant notification prefs select own" on public.tenant_notification_prefs;
create policy "tenant notification prefs select own"
  on public.tenant_notification_prefs
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "tenant notification prefs insert own" on public.tenant_notification_prefs;
create policy "tenant notification prefs insert own"
  on public.tenant_notification_prefs
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "tenant notification prefs update own" on public.tenant_notification_prefs;
create policy "tenant notification prefs update own"
  on public.tenant_notification_prefs
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "tenant notification prefs delete own" on public.tenant_notification_prefs;
create policy "tenant notification prefs delete own"
  on public.tenant_notification_prefs
  for delete
  to authenticated
  using (auth.uid() = profile_id);
