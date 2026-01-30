-- Message threads + posts support for dashboard inbox replies.

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  subject text,
  last_post_at timestamptz not null default now(),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (property_id, tenant_id, host_id)
);

alter table public.messages
  add column if not exists thread_id uuid references public.message_threads (id) on delete set null,
  add column if not exists sender_role text,
  add column if not exists read_at timestamptz,
  add column if not exists metadata jsonb;

create index if not exists idx_message_threads_property on public.message_threads (property_id);
create index if not exists idx_message_threads_host on public.message_threads (host_id, last_post_at desc);
create index if not exists idx_message_threads_tenant on public.message_threads (tenant_id, last_post_at desc);
create index if not exists idx_messages_thread on public.messages (thread_id, created_at desc);

-- Backfill threads from existing messages.
with base as (
  select
    m.id as message_id,
    m.property_id,
    p.owner_id as host_id,
    case
      when m.sender_id = p.owner_id then m.recipient_id
      else m.sender_id
    end as tenant_id,
    m.created_at
  from public.messages m
  join public.properties p on p.id = m.property_id
),
threads as (
  select distinct property_id, tenant_id, host_id from base
),
upserted as (
  insert into public.message_threads (property_id, tenant_id, host_id, last_post_at)
  select
    t.property_id,
    t.tenant_id,
    t.host_id,
    (select max(b.created_at) from base b
      where b.property_id = t.property_id
        and b.tenant_id = t.tenant_id
        and b.host_id = t.host_id
    )
  from threads t
  on conflict (property_id, tenant_id, host_id)
  do update set last_post_at = excluded.last_post_at
  returning id, property_id, tenant_id, host_id
)
update public.messages m
set thread_id = mt.id
from public.message_threads mt
join public.properties p on p.id = mt.property_id
where m.property_id = mt.property_id
  and mt.host_id = p.owner_id
  and mt.tenant_id = case
    when m.sender_id = p.owner_id then m.recipient_id
    else m.sender_id
  end;

-- Backfill sender_role for existing messages where possible.
update public.messages m
set sender_role = coalesce(pr.role::text, case when m.sender_id = p.owner_id then 'landlord' else 'tenant' end)
from public.profiles pr, public.properties p
where m.sender_id = pr.id
  and p.id = m.property_id
  and m.sender_role is null;

-- RLS: message_threads
alter table public.message_threads enable row level security;
alter table public.message_threads force row level security;

drop policy if exists "message threads participant read" on public.message_threads;
create policy "message threads participant read" on public.message_threads
  for select
  using (
    auth.uid() = tenant_id
    or auth.uid() = host_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "message threads participant insert" on public.message_threads;
create policy "message threads participant insert" on public.message_threads
  for insert
  with check (
    auth.uid() = tenant_id or auth.uid() = host_id
  );

drop policy if exists "message threads participant update" on public.message_threads;
create policy "message threads participant update" on public.message_threads
  for update
  using (
    auth.uid() = tenant_id or auth.uid() = host_id
  )
  with check (
    auth.uid() = tenant_id or auth.uid() = host_id
  );

-- RLS: messages read receipts (participants can mark read)
drop policy if exists "messages recipient update read" on public.messages;
create policy "messages recipient update read" on public.messages
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
