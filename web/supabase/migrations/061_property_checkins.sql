-- Property check-in signals (privacy-safe).
-- Append-only log: no raw GPS coordinates stored.

create table if not exists public.property_checkins (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  distance_bucket text check (distance_bucket is null or distance_bucket in ('onsite','near','far')),
  method text check (method in ('browser_geolocation','cleared')),
  accuracy_m integer check (accuracy_m is null or accuracy_m >= 0),
  verified_by uuid,
  role text,
  note text
);

create index if not exists property_checkins_property_id_created_at_idx
  on public.property_checkins (property_id, created_at desc);

alter table public.property_checkins enable row level security;

-- Allow owners/agents/admins to insert check-ins for their properties.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_checkins'
      and policyname = 'checkins owner/admin insert'
  ) then
    execute $policy$
      create policy "checkins owner/admin insert" on public.property_checkins
      for insert
      to authenticated
      with check (
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
    $policy$;
  end if;
end$$;

-- Allow owners/agents/admins to select check-ins for their properties.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_checkins'
      and policyname = 'checkins owner/admin select'
  ) then
    execute $policy$
      create policy "checkins owner/admin select" on public.property_checkins
      for select
      to authenticated
      using (
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
    $policy$;
  end if;
end$$;
