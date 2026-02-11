-- W2: Saved collections (wishlists) and shareable read-only links.

create table if not exists public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  share_id uuid unique null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_collections_title_chk check (char_length(btrim(title)) >= 1)
);

create table if not exists public.saved_collection_items (
  collection_id uuid not null references public.saved_collections(id) on delete cascade,
  listing_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, listing_id)
);

create index if not exists idx_saved_collections_owner
  on public.saved_collections (owner_user_id);

create unique index if not exists idx_saved_collections_owner_default_unique
  on public.saved_collections (owner_user_id)
  where is_default = true;

create index if not exists idx_saved_collection_items_listing
  on public.saved_collection_items (listing_id);

create or replace function public.touch_saved_collections_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_collections_touch_updated_at on public.saved_collections;
create trigger saved_collections_touch_updated_at
before update on public.saved_collections
for each row execute function public.touch_saved_collections_updated_at();

create or replace function public.touch_saved_collections_from_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.saved_collections
  set updated_at = now()
  where id = coalesce(new.collection_id, old.collection_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists saved_collection_items_touch_collections_ins on public.saved_collection_items;
create trigger saved_collection_items_touch_collections_ins
after insert on public.saved_collection_items
for each row execute function public.touch_saved_collections_from_items();

drop trigger if exists saved_collection_items_touch_collections_del on public.saved_collection_items;
create trigger saved_collection_items_touch_collections_del
after delete on public.saved_collection_items
for each row execute function public.touch_saved_collections_from_items();

alter table public.saved_collections enable row level security;
alter table public.saved_collections force row level security;

alter table public.saved_collection_items enable row level security;
alter table public.saved_collection_items force row level security;

drop policy if exists "saved collections owner select" on public.saved_collections;
create policy "saved collections owner select"
  on public.saved_collections
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "saved collections owner insert" on public.saved_collections;
create policy "saved collections owner insert"
  on public.saved_collections
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "saved collections owner update" on public.saved_collections;
create policy "saved collections owner update"
  on public.saved_collections
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "saved collections owner delete" on public.saved_collections;
create policy "saved collections owner delete"
  on public.saved_collections
  for delete
  using (auth.uid() = owner_user_id);

drop policy if exists "saved collections service all" on public.saved_collections;
create policy "saved collections service all"
  on public.saved_collections
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "saved items owner select" on public.saved_collection_items;
create policy "saved items owner select"
  on public.saved_collection_items
  for select
  using (
    exists (
      select 1
      from public.saved_collections c
      where c.id = saved_collection_items.collection_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "saved items owner insert" on public.saved_collection_items;
create policy "saved items owner insert"
  on public.saved_collection_items
  for insert
  with check (
    exists (
      select 1
      from public.saved_collections c
      where c.id = saved_collection_items.collection_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "saved items owner delete" on public.saved_collection_items;
create policy "saved items owner delete"
  on public.saved_collection_items
  for delete
  using (
    exists (
      select 1
      from public.saved_collections c
      where c.id = saved_collection_items.collection_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "saved items service all" on public.saved_collection_items;
create policy "saved items service all"
  on public.saved_collection_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
