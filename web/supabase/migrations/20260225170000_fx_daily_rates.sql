-- Daily cached FX rates used for display-only approximate totals.

create table if not exists public.fx_daily_rates (
  date date primary key,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  rates jsonb not null default '{}'::jsonb,
  source text not null,
  fetched_at timestamptz not null default now()
);

create index if not exists fx_daily_rates_fetched_at_idx
  on public.fx_daily_rates (fetched_at desc);

alter table public.fx_daily_rates enable row level security;
alter table public.fx_daily_rates force row level security;

drop policy if exists "fx daily rates admin read" on public.fx_daily_rates;
create policy "fx daily rates admin read"
  on public.fx_daily_rates
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

drop policy if exists "fx daily rates service write" on public.fx_daily_rates;
create policy "fx daily rates service write"
  on public.fx_daily_rates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
