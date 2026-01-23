-- R16.9a: host video MVP (one video per property)

create table if not exists public.property_videos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  video_url text not null,
  storage_path text not null,
  bytes bigint not null,
  format text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for lookups (unique constraint already exists)
create index if not exists idx_property_videos_property on public.property_videos(property_id);

-- Enable and force RLS
alter table public.property_videos enable row level security;
alter table public.property_videos force row level security;

-- Policies (host/admin/agent only; no public read)
drop policy if exists "videos owner/admin read" on public.property_videos;
create policy "videos owner/admin read" on public.property_videos
  for select using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (
          pr.owner_id = auth.uid()
          or exists (
            select 1 from public.agent_delegations d
            where d.agent_id = auth.uid()
              and d.landlord_id = pr.owner_id
              and d.status = 'active'
          )
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "videos owner/admin insert" on public.property_videos;
create policy "videos owner/admin insert" on public.property_videos
  for insert with check (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (
          pr.owner_id = auth.uid()
          or exists (
            select 1 from public.agent_delegations d
            where d.agent_id = auth.uid()
              and d.landlord_id = pr.owner_id
              and d.status = 'active'
          )
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "videos owner/admin update" on public.property_videos;
create policy "videos owner/admin update" on public.property_videos
  for update using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (
          pr.owner_id = auth.uid()
          or exists (
            select 1 from public.agent_delegations d
            where d.agent_id = auth.uid()
              and d.landlord_id = pr.owner_id
              and d.status = 'active'
          )
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  ) with check (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (
          pr.owner_id = auth.uid()
          or exists (
            select 1 from public.agent_delegations d
            where d.agent_id = auth.uid()
              and d.landlord_id = pr.owner_id
              and d.status = 'active'
          )
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "videos owner/admin delete" on public.property_videos;
create policy "videos owner/admin delete" on public.property_videos
  for delete using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (
          pr.owner_id = auth.uid()
          or exists (
            select 1 from public.agent_delegations d
            where d.agent_id = auth.uid()
              and d.landlord_id = pr.owner_id
              and d.status = 'active'
          )
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );
