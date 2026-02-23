-- Shortlet internal job run ledger for reminders observability.

create table if not exists public.shortlet_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  run_key text not null unique,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  meta jsonb not null default '{}'::jsonb,
  error text null,
  created_at timestamptz not null default now()
);

create index if not exists shortlet_job_runs_job_started_idx
  on public.shortlet_job_runs (job_name, started_at desc);

create index if not exists shortlet_job_runs_status_started_idx
  on public.shortlet_job_runs (status, started_at desc);

alter table public.shortlet_job_runs enable row level security;
alter table public.shortlet_job_runs force row level security;

drop policy if exists "shortlet job runs admin read" on public.shortlet_job_runs;
create policy "shortlet job runs admin read"
  on public.shortlet_job_runs
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

drop policy if exists "shortlet job runs service write" on public.shortlet_job_runs;
create policy "shortlet job runs service write"
  on public.shortlet_job_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
