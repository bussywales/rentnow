-- W3 retention: allow users to pause/resume followed searches.

alter table public.saved_searches
  add column if not exists is_active boolean not null default true;

create index if not exists idx_saved_searches_user_active
  on public.saved_searches (user_id, is_active, created_at desc);
