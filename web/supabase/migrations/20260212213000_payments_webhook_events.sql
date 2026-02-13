-- W6.1.1 payments ops: webhook audit log + receipt dedupe marker

alter table if exists public.payments
  add column if not exists receipt_sent_at timestamptz null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event text null,
  reference text null,
  signature text null,
  payload jsonb not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  processed_at timestamptz null,
  process_error text null,
  constraint payment_webhook_events_provider_chk check (provider in ('paystack'))
);

create unique index if not exists payment_webhook_events_provider_payload_hash_uidx
  on public.payment_webhook_events(provider, payload_hash);

create index if not exists payment_webhook_events_reference_idx
  on public.payment_webhook_events(reference);

create index if not exists payment_webhook_events_received_at_idx
  on public.payment_webhook_events(received_at desc);

alter table public.payment_webhook_events enable row level security;
alter table public.payment_webhook_events force row level security;

drop policy if exists "payment webhook events admin select" on public.payment_webhook_events;
create policy "payment webhook events admin select"
  on public.payment_webhook_events
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "payment webhook events service all" on public.payment_webhook_events;
create policy "payment webhook events service all"
  on public.payment_webhook_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
