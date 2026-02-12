-- W3.3: Saved-search email alerts (instant/daily/weekly) scheduling fields.

alter table public.saved_searches
  add column if not exists alerts_enabled boolean not null default true,
  add column if not exists alert_frequency text not null default 'daily',
  add column if not exists alert_last_sent_at timestamptz null,
  add column if not exists alert_baseline_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_searches_alert_frequency_check'
      and conrelid = 'public.saved_searches'::regclass
  ) then
    alter table public.saved_searches
      add constraint saved_searches_alert_frequency_check
      check (alert_frequency in ('instant', 'daily', 'weekly'));
  end if;
end $$;

create index if not exists idx_saved_searches_alert_schedule
  on public.saved_searches (
    user_id,
    is_active,
    alerts_enabled,
    alert_frequency,
    coalesce(alert_last_sent_at, created_at)
  );

alter table public.saved_search_alerts
  add column if not exists alert_dedupe_key text null;

create unique index if not exists idx_saved_search_alerts_alert_dedupe_key
  on public.saved_search_alerts (alert_dedupe_key)
  where alert_dedupe_key is not null;

