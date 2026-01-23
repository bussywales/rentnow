-- R16.9a.3: tighten property_videos RLS to mirror property_images (owner, delegated agent, admin)

-- Drop existing policies to recreate with delegation-aware checks
drop policy if exists "videos owner/admin read" on public.property_videos;
drop policy if exists "videos owner/admin insert" on public.property_videos;
drop policy if exists "videos owner/admin update" on public.property_videos;
drop policy if exists "videos owner/admin delete" on public.property_videos;

-- Shared condition: owner, delegated agent, or admin on parent property
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
