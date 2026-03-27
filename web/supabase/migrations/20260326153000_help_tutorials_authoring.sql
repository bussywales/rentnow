create table if not exists public.help_tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  summary text not null,
  audience text not null,
  visibility text not null default 'internal',
  status text not null default 'draft',
  video_url text,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_tutorials_audience_check check (audience in ('tenant', 'landlord', 'agent', 'admin')),
  constraint help_tutorials_visibility_check check (visibility in ('public', 'internal')),
  constraint help_tutorials_status_check check (status in ('draft', 'published')),
  constraint help_tutorials_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint help_tutorials_visibility_audience_check check (
    (audience = 'admin' and visibility = 'internal')
    or (audience in ('tenant', 'landlord', 'agent') and visibility = 'public')
  )
);

create unique index if not exists help_tutorials_audience_slug_unique
  on public.help_tutorials (audience, slug);

create index if not exists help_tutorials_status_visibility_idx
  on public.help_tutorials (status, visibility, updated_at desc);

create index if not exists help_tutorials_audience_status_idx
  on public.help_tutorials (audience, status, updated_at desc);

create or replace function public.touch_help_tutorials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists help_tutorials_set_updated_at on public.help_tutorials;
create trigger help_tutorials_set_updated_at
before update on public.help_tutorials
for each row
execute function public.touch_help_tutorials_updated_at();

alter table public.help_tutorials enable row level security;
alter table public.help_tutorials force row level security;

drop policy if exists "help tutorials select" on public.help_tutorials;
create policy "help tutorials select" on public.help_tutorials
  for select
  using (
    (
      status = 'published'
      and visibility = 'public'
    )
    or (
      status = 'published'
      and visibility = 'internal'
      and public.is_admin()
    )
    or public.is_admin()
  );

drop policy if exists "help tutorials insert admin" on public.help_tutorials;
create policy "help tutorials insert admin" on public.help_tutorials
  for insert
  with check (public.is_admin());

drop policy if exists "help tutorials update admin" on public.help_tutorials;
create policy "help tutorials update admin" on public.help_tutorials
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "help tutorials delete admin" on public.help_tutorials;
create policy "help tutorials delete admin" on public.help_tutorials
  for delete
  using (public.is_admin());
