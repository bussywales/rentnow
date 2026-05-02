create table if not exists public.delivery_monitor_state_overrides (
  item_key text primary key,
  status text not null check (status in ('green', 'amber', 'red')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_monitor_test_runs (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  testing_status text not null check (testing_status in ('not_started', 'in_progress', 'passed', 'failed')),
  tester_name text not null check (char_length(trim(tester_name)) between 1 and 120),
  notes text,
  tested_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_monitor_notes (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  author_name text not null check (char_length(trim(author_name)) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists delivery_monitor_test_runs_item_key_tested_at_idx
  on public.delivery_monitor_test_runs (item_key, tested_at desc);

create index if not exists delivery_monitor_notes_item_key_created_at_idx
  on public.delivery_monitor_notes (item_key, created_at desc);

create or replace function public.delivery_monitor_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

DROP TRIGGER IF EXISTS delivery_monitor_state_overrides_touch_updated_at ON public.delivery_monitor_state_overrides;
create trigger delivery_monitor_state_overrides_touch_updated_at
before update on public.delivery_monitor_state_overrides
for each row
execute function public.delivery_monitor_touch_updated_at();

alter table public.delivery_monitor_state_overrides enable row level security;
alter table public.delivery_monitor_test_runs enable row level security;
alter table public.delivery_monitor_notes enable row level security;

DROP POLICY IF EXISTS "delivery monitor status overrides admin select" ON public.delivery_monitor_state_overrides;
create policy "delivery monitor status overrides admin select"
  on public.delivery_monitor_state_overrides
  for select
  using (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor status overrides admin insert" ON public.delivery_monitor_state_overrides;
create policy "delivery monitor status overrides admin insert"
  on public.delivery_monitor_state_overrides
  for insert
  with check (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor status overrides admin update" ON public.delivery_monitor_state_overrides;
create policy "delivery monitor status overrides admin update"
  on public.delivery_monitor_state_overrides
  for update
  using (public.is_admin())
  with check (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor test runs admin select" ON public.delivery_monitor_test_runs;
create policy "delivery monitor test runs admin select"
  on public.delivery_monitor_test_runs
  for select
  using (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor test runs admin insert" ON public.delivery_monitor_test_runs;
create policy "delivery monitor test runs admin insert"
  on public.delivery_monitor_test_runs
  for insert
  with check (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor notes admin select" ON public.delivery_monitor_notes;
create policy "delivery monitor notes admin select"
  on public.delivery_monitor_notes
  for select
  using (public.is_admin());

DROP POLICY IF EXISTS "delivery monitor notes admin insert" ON public.delivery_monitor_notes;
create policy "delivery monitor notes admin insert"
  on public.delivery_monitor_notes
  for insert
  with check (public.is_admin());
