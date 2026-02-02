-- Admin-managed legal documents + acceptance tracking

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  audience text not null,
  version int not null default 1,
  status text not null default 'draft',
  title text not null,
  content_md text not null,
  effective_at timestamptz null,
  published_at timestamptz null,
  published_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  change_log text null,
  constraint legal_documents_status_check check (status in ('draft', 'published', 'archived')),
  constraint legal_documents_audience_check check (audience in ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP'))
);

create unique index if not exists legal_documents_unique_version
  on public.legal_documents (jurisdiction, audience, version);

create unique index if not exists legal_documents_published_unique
  on public.legal_documents (jurisdiction, audience)
  where status = 'published';

create index if not exists legal_documents_status_idx
  on public.legal_documents (jurisdiction, audience, status, version desc);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  jurisdiction text not null,
  audience text not null,
  version int not null,
  accepted_at timestamptz not null default now(),
  ip text null,
  user_agent text null,
  constraint legal_acceptances_audience_check check (audience in ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP'))
);

create unique index if not exists legal_acceptances_unique_user_doc
  on public.legal_acceptances (user_id, jurisdiction, audience, version);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, accepted_at desc);

-- Seed Nigeria drafts
insert into public.legal_documents (jurisdiction, audience, version, status, title, content_md, change_log)
values
  ('NG', 'MASTER', 1, 'draft', 'Master Terms (Nigeria)', 'TODO: paste final lawyer copy.', 'Seed draft'),
  ('NG', 'TENANT', 1, 'draft', 'Tenant Terms (Nigeria)', 'TODO: paste final lawyer copy.', 'Seed draft'),
  ('NG', 'LANDLORD_AGENT', 1, 'draft', 'Landlord/Agent Terms (Nigeria)', 'TODO: paste final lawyer copy.', 'Seed draft'),
  ('NG', 'ADMIN_OPS', 1, 'draft', 'Admin/Ops Terms (Nigeria)', 'TODO: paste final lawyer copy.', 'Seed draft'),
  ('NG', 'AUP', 1, 'draft', 'Acceptable Use Policy (Nigeria)', 'TODO: paste final lawyer copy.', 'Seed draft')
on conflict (jurisdiction, audience, version) do nothing;

-- RLS
alter table public.legal_documents enable row level security;
alter table public.legal_documents force row level security;
alter table public.legal_acceptances enable row level security;
alter table public.legal_acceptances force row level security;

drop policy if exists "legal documents published read" on public.legal_documents;
create policy "legal documents published read" on public.legal_documents
  for select
  to authenticated, anon
  using (status = 'published');

drop policy if exists "legal documents admin write" on public.legal_documents;
create policy "legal documents admin write" on public.legal_documents
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- legal_acceptances policies

drop policy if exists "legal acceptances select self" on public.legal_acceptances;
create policy "legal acceptances select self" on public.legal_acceptances
  for select
  using (auth.uid() = user_id);

drop policy if exists "legal acceptances insert self" on public.legal_acceptances;
create policy "legal acceptances insert self" on public.legal_acceptances
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "legal acceptances admin read" on public.legal_acceptances;
create policy "legal acceptances admin read" on public.legal_acceptances
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Ask PostgREST to reload schema immediately.
notify pgrst, 'reload schema';
