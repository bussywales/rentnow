-- Verification center tables + trust snapshot refresh (P1)

create table if not exists public.user_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_verified_at timestamptz null,
  phone_e164 text null,
  phone_verified_at timestamptz null,
  bank_verified_at timestamptz null,
  bank_provider text null,
  bank_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.verification_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('phone_email_fallback')),
  target text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists user_verifications_updated_at_idx on public.user_verifications(updated_at desc);
create index if not exists verification_otps_user_idx on public.verification_otps(user_id, created_at desc);
create index if not exists verification_otps_target_idx on public.verification_otps(target, created_at desc);

-- Allow admin actions not tied to a property
alter table public.admin_actions_log
  add column if not exists subject_user_id uuid references public.profiles(id);

alter table public.admin_actions_log
  alter column property_id drop not null;

create index if not exists admin_actions_log_subject_user_id_idx on public.admin_actions_log(subject_user_id);

-- updated_at trigger
create or replace function public.touch_user_verifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_verifications_set_updated_at on public.user_verifications;
create trigger user_verifications_set_updated_at
before update on public.user_verifications
for each row
execute function public.touch_user_verifications_updated_at();

-- RLS
alter table public.user_verifications enable row level security;
alter table public.verification_otps enable row level security;

-- Prevent direct mutation of verified fields by authenticated users.
revoke update (email_verified_at, phone_verified_at, bank_verified_at, bank_provider, bank_metadata)
  on public.user_verifications from authenticated;

-- user_verifications policies

drop policy if exists "user verifications select self" on public.user_verifications;
create policy "user verifications select self" on public.user_verifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "user verifications insert self" on public.user_verifications;
create policy "user verifications insert self" on public.user_verifications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user verifications update self" on public.user_verifications;
create policy "user verifications update self" on public.user_verifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- admin read/write

drop policy if exists "user verifications admin read" on public.user_verifications;
create policy "user verifications admin read" on public.user_verifications
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "user verifications admin write" on public.user_verifications;
create policy "user verifications admin write" on public.user_verifications
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- verification_otps policies (server-managed, minimal)

drop policy if exists "verification otps insert self" on public.verification_otps;
create policy "verification otps insert self" on public.verification_otps
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "verification otps select self" on public.verification_otps;
create policy "verification otps select self" on public.verification_otps
  for select
  using (auth.uid() = user_id);

drop policy if exists "verification otps update self" on public.verification_otps;
create policy "verification otps update self" on public.verification_otps
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trust snapshot RPC now prefers user_verifications (email/phone/bank)
create or replace function public.get_trust_snapshot(target_profile_id uuid)
returns table (
  profile_id uuid,
  email_verified boolean,
  phone_verified boolean,
  bank_verified boolean,
  reliability_power text,
  reliability_water text,
  reliability_internet text
)
language sql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
  select
    p.id as profile_id,
    coalesce(uv.email_verified_at is not null, p.email_verified) as email_verified,
    coalesce(uv.phone_verified_at is not null, p.phone_verified) as phone_verified,
    coalesce(uv.bank_verified_at is not null, p.bank_verified) as bank_verified,
    p.reliability_power,
    p.reliability_water,
    p.reliability_internet
  from public.profiles p
  left join public.user_verifications uv on uv.user_id = p.id
  where p.id = target_profile_id
    and p.role in ('landlord', 'agent');
$$;

revoke all on function public.get_trust_snapshot(uuid) from public;
grant execute on function public.get_trust_snapshot(uuid) to anon, authenticated;
