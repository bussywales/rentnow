-- Property Requests Phase 4 responder workflow

create table if not exists public.property_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.property_requests(id) on delete cascade,
  responder_user_id uuid not null references public.profiles(id) on delete cascade,
  responder_role text not null,
  message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_request_responses_responder_role_check check (responder_role in ('landlord', 'agent')),
  constraint property_request_responses_message_check check (message is null or char_length(message) <= 500)
);

create table if not exists public.property_request_response_items (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.property_request_responses(id) on delete cascade,
  listing_id uuid not null references public.properties(id) on delete cascade,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint property_request_response_items_position_check check (position >= 0 and position < 3),
  constraint property_request_response_items_unique_listing_per_response unique (response_id, listing_id)
);

create index if not exists property_request_responses_request_created_idx
  on public.property_request_responses(request_id, created_at desc);

create index if not exists property_request_responses_responder_created_idx
  on public.property_request_responses(responder_user_id, created_at desc);

create index if not exists property_request_response_items_response_position_idx
  on public.property_request_response_items(response_id, position asc, created_at asc);

create or replace function public.touch_property_request_responses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_request_responses_touch_updated_at on public.property_request_responses;
create trigger property_request_responses_touch_updated_at
before update on public.property_request_responses
for each row execute function public.touch_property_request_responses_updated_at();

alter table public.property_request_responses enable row level security;
alter table public.property_request_responses force row level security;
alter table public.property_request_response_items enable row level security;
alter table public.property_request_response_items force row level security;

drop policy if exists "property request responses owner/admin/responder select" on public.property_request_responses;
create policy "property request responses owner/admin/responder select"
  on public.property_request_responses
  for select
  using (
    public.is_admin()
    or responder_user_id = auth.uid()
    or exists (
      select 1
      from public.property_requests pr
      where pr.id = request_id
        and pr.owner_user_id = auth.uid()
    )
  );

drop policy if exists "property request responses responder insert" on public.property_request_responses;
create policy "property request responses responder insert"
  on public.property_request_responses
  for insert
  with check (
    responder_user_id = auth.uid()
    and responder_role in ('landlord', 'agent')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role::text = responder_role
    )
    and exists (
      select 1
      from public.property_requests pr
      where pr.id = request_id
        and pr.status = 'open'
        and pr.published_at is not null
        and (pr.expires_at is null or pr.expires_at > now())
    )
  );

drop policy if exists "property request responses admin write" on public.property_request_responses;
create policy "property request responses admin write"
  on public.property_request_responses
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "property request response items select visible parent" on public.property_request_response_items;
create policy "property request response items select visible parent"
  on public.property_request_response_items
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.property_request_responses r
      join public.property_requests pr on pr.id = r.request_id
      where r.id = response_id
        and (
          r.responder_user_id = auth.uid()
          or pr.owner_user_id = auth.uid()
        )
    )
  );

drop policy if exists "property request response items responder insert" on public.property_request_response_items;
create policy "property request response items responder insert"
  on public.property_request_response_items
  for insert
  with check (
    exists (
      select 1
      from public.property_request_responses r
      where r.id = response_id
        and r.responder_user_id = auth.uid()
    )
  );

drop policy if exists "property request response items admin write" on public.property_request_response_items;
create policy "property request response items admin write"
  on public.property_request_response_items
  for all
  using (public.is_admin())
  with check (public.is_admin());
