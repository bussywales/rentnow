-- App settings table for feature flags and small configs
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed toggle for tenant photo trust signals
insert into public.app_settings(key, value)
values ('show_tenant_photo_trust_signals', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

-- RLS: safe reads for authenticated; updates restricted to service role (or direct SQL)
alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'app_settings_read'
  ) then
    create policy "app_settings_read"
      on public.app_settings
      for select
      to authenticated
      using (true);
  end if;
end$$;

-- Deny updates/inserts/deletes by default unless elevated role is used.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'app_settings_no_mutation_auth'
  ) then
    create policy "app_settings_no_mutation_auth"
      on public.app_settings
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;
