-- Track per-user read state for message threads.

create table if not exists public.message_thread_reads (
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists idx_message_thread_reads_user on public.message_thread_reads (user_id);
create index if not exists idx_message_thread_reads_thread on public.message_thread_reads (thread_id);

alter table public.message_thread_reads enable row level security;
alter table public.message_thread_reads force row level security;

drop policy if exists "message thread reads self read" on public.message_thread_reads;
create policy "message thread reads self read" on public.message_thread_reads
  for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "message thread reads self upsert" on public.message_thread_reads;
create policy "message thread reads self upsert" on public.message_thread_reads
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "message thread reads self update" on public.message_thread_reads;
create policy "message thread reads self update" on public.message_thread_reads
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
