-- Admin review decision desk tables (checklist, templates, audit log, saved views)
create table if not exists public.admin_review_notes (
  property_id uuid primary key references public.properties(id) on delete cascade,
  checklist_json jsonb not null default '{}'::jsonb,
  internal_notes text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  reasons jsonb not null default '[]'::jsonb,
  message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  action_type text not null,
  payload_json jsonb,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  route text not null,
  query_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_log_property_id_idx on public.admin_actions_log(property_id);
create index if not exists admin_review_notes_updated_at_idx on public.admin_review_notes(updated_at desc);
create index if not exists admin_saved_views_user_id_idx on public.admin_saved_views(user_id);
create index if not exists admin_message_templates_user_id_idx on public.admin_message_templates(user_id);

alter table public.admin_review_notes enable row level security;
alter table public.admin_message_templates enable row level security;
alter table public.admin_actions_log enable row level security;
alter table public.admin_saved_views enable row level security;

-- Admin-only policies
drop policy if exists "admin review notes admin read" on public.admin_review_notes;
create policy "admin review notes admin read" on public.admin_review_notes
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin review notes admin write" on public.admin_review_notes;
create policy "admin review notes admin write" on public.admin_review_notes
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin templates read own" on public.admin_message_templates;
create policy "admin templates read own" on public.admin_message_templates
  for select
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admin templates write own" on public.admin_message_templates;
create policy "admin templates write own" on public.admin_message_templates
  for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admin actions log read" on public.admin_actions_log;
create policy "admin actions log read" on public.admin_actions_log
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin actions log insert" on public.admin_actions_log;
create policy "admin actions log insert" on public.admin_actions_log
  for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin saved views read own" on public.admin_saved_views;
create policy "admin saved views read own" on public.admin_saved_views
  for select
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admin saved views write own" on public.admin_saved_views;
create policy "admin saved views write own" on public.admin_saved_views
  for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
