-- Add disclaimer audience + legal versions tracker

alter table public.legal_documents
  drop constraint if exists legal_documents_audience_check;

alter table public.legal_documents
  add constraint legal_documents_audience_check
  check (audience in ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP', 'DISCLAIMER'));

alter table public.legal_acceptances
  drop constraint if exists legal_acceptances_audience_check;

alter table public.legal_acceptances
  add constraint legal_acceptances_audience_check
  check (audience in ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP', 'DISCLAIMER'));

create table if not exists public.legal_versions (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  audience text not null,
  version int not null,
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  effective_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_versions_audience_check
    check (audience in ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP', 'DISCLAIMER'))
);

create unique index if not exists legal_versions_unique
  on public.legal_versions (jurisdiction, audience);

create index if not exists legal_versions_lookup_idx
  on public.legal_versions (jurisdiction, audience, version desc);

insert into public.legal_documents (jurisdiction, audience, version, status, title, content_md, change_log, published_at, effective_at)
values
  (
    'NG',
    'DISCLAIMER',
    1,
    'published',
    'Marketplace Disclaimer (Nigeria)',
    'PropatyHub is a marketplace. Listings, descriptions, and availability are provided by independent hosts, landlords, and agents. PropatyHub does not own, manage, or guarantee any property. Always verify details directly with the listing owner before making commitments.',
    'Seed disclaimer',
    now(),
    now()
  )
on conflict (jurisdiction, audience, version) do nothing;

insert into public.legal_versions (jurisdiction, audience, version, document_id, effective_at, published_at, updated_at)
select jurisdiction, audience, version, id, effective_at, published_at, now()
from public.legal_documents
where status = 'published'
on conflict (jurisdiction, audience)
do update set
  version = excluded.version,
  document_id = excluded.document_id,
  effective_at = excluded.effective_at,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;

alter table public.legal_versions enable row level security;
alter table public.legal_versions force row level security;

drop policy if exists "legal versions public read" on public.legal_versions;
create policy "legal versions public read" on public.legal_versions
  for select
  to authenticated, anon
  using (true);

drop policy if exists "legal versions admin write" on public.legal_versions;
create policy "legal versions admin write" on public.legal_versions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

notify pgrst, 'reload schema';
