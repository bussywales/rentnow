-- Marketing-friendly public advertiser slugs for /agents/[slug].

alter table public.profiles
  add column if not exists public_slug text null;

update public.profiles
set public_slug = null
where public_slug is not null
  and nullif(btrim(public_slug), '') is null;

update public.profiles
set public_slug = lower(btrim(public_slug))
where public_slug is not null
  and public_slug <> lower(btrim(public_slug));

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(public_slug)
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_rank
  from public.profiles
  where public_slug is not null
)
update public.profiles as profiles
set public_slug = null
from ranked
where profiles.id = ranked.id
  and ranked.row_rank > 1;

drop index if exists profiles_public_slug_lower_unique_idx;
create unique index if not exists profiles_public_slug_lower_unique_idx
  on public.profiles (lower(public_slug))
  where public_slug is not null;

alter table public.profiles
  drop constraint if exists profiles_public_slug_not_blank_chk;
alter table public.profiles
  add constraint profiles_public_slug_not_blank_chk
  check (public_slug is null or nullif(btrim(public_slug), '') is not null);
