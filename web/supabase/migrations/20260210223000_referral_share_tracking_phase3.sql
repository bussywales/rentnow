-- Phase 3: referral share tracking, attribution, and invite reminders.

create table if not exists public.referral_share_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  name text not null,
  channel text not null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  landing_path text not null default '/',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_share_campaigns_name_chk check (char_length(btrim(name)) >= 1),
  constraint referral_share_campaigns_channel_chk check (
    channel in ('whatsapp', 'email', 'linkedin', 'facebook', 'x', 'sms', 'qr', 'copy', 'other')
  ),
  constraint referral_share_campaigns_landing_path_chk check (left(landing_path, 1) = '/')
);

create unique index if not exists idx_referral_share_campaigns_owner_name
  on public.referral_share_campaigns (owner_id, name);

create index if not exists idx_referral_share_campaigns_owner_created
  on public.referral_share_campaigns (owner_id, created_at desc);

create index if not exists idx_referral_share_campaigns_referral_code
  on public.referral_share_campaigns (referral_code);

create or replace function public.touch_referral_share_campaigns_updated_at()
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

drop trigger if exists referral_share_campaigns_touch_updated_at on public.referral_share_campaigns;
create trigger referral_share_campaigns_touch_updated_at
before update on public.referral_share_campaigns
for each row execute function public.touch_referral_share_campaigns_updated_at();

create table if not exists public.referral_touch_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid null references public.referral_share_campaigns(id) on delete set null,
  referral_code text null,
  event_type text not null,
  anon_id text null,
  viewer_user_id uuid null references auth.users(id) on delete set null,
  referred_user_id uuid null references auth.users(id) on delete set null,
  user_agent text null,
  ip_hash text null,
  country_code text null,
  city text null,
  referrer_url text null,
  landing_url text null,
  created_at timestamptz not null default now(),
  constraint referral_touch_events_event_type_chk check (
    event_type in ('click', 'captured', 'signup', 'paid_event')
  )
);

create index if not exists idx_referral_touch_events_campaign_created
  on public.referral_touch_events (campaign_id, created_at desc);

create index if not exists idx_referral_touch_events_referral_code_created
  on public.referral_touch_events (referral_code, created_at desc);

create index if not exists idx_referral_touch_events_referred_event
  on public.referral_touch_events (referred_user_id, event_type, created_at desc);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid null references public.referral_share_campaigns(id) on delete set null,
  referral_code text not null,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referrer_owner_id uuid not null references auth.users(id) on delete cascade,
  first_touch_event_id uuid null references public.referral_touch_events(id) on delete set null,
  captured_event_id uuid null references public.referral_touch_events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint referral_attributions_referred_unique unique (referred_user_id)
);

create index if not exists idx_referral_attributions_owner_campaign
  on public.referral_attributions (referrer_owner_id, campaign_id);

create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid null references public.referral_share_campaigns(id) on delete set null,
  invitee_name text not null,
  invitee_contact text null,
  status text not null default 'draft',
  reminder_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint referral_invites_status_chk check (status in ('draft', 'sent', 'reminded', 'converted', 'closed')),
  constraint referral_invites_name_chk check (char_length(btrim(invitee_name)) >= 1)
);

create index if not exists idx_referral_invites_owner_created
  on public.referral_invites (owner_id, created_at desc);

create index if not exists idx_referral_invites_owner_status
  on public.referral_invites (owner_id, status, reminder_at);

alter table public.referral_share_campaigns enable row level security;
alter table public.referral_share_campaigns force row level security;

alter table public.referral_touch_events enable row level security;
alter table public.referral_touch_events force row level security;

alter table public.referral_attributions enable row level security;
alter table public.referral_attributions force row level security;

alter table public.referral_invites enable row level security;
alter table public.referral_invites force row level security;

drop policy if exists "referral campaigns owner select" on public.referral_share_campaigns;
create policy "referral campaigns owner select"
  on public.referral_share_campaigns
  for select
  using (auth.uid() = owner_id);

drop policy if exists "referral campaigns owner insert" on public.referral_share_campaigns;
create policy "referral campaigns owner insert"
  on public.referral_share_campaigns
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "referral campaigns owner update" on public.referral_share_campaigns;
create policy "referral campaigns owner update"
  on public.referral_share_campaigns
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "referral campaigns owner delete" on public.referral_share_campaigns;
create policy "referral campaigns owner delete"
  on public.referral_share_campaigns
  for delete
  using (auth.uid() = owner_id);

drop policy if exists "referral campaigns admin all" on public.referral_share_campaigns;
create policy "referral campaigns admin all"
  on public.referral_share_campaigns
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "referral campaigns service all" on public.referral_share_campaigns;
create policy "referral campaigns service all"
  on public.referral_share_campaigns
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "referral touch events owner select" on public.referral_touch_events;
create policy "referral touch events owner select"
  on public.referral_touch_events
  for select
  using (
    exists (
      select 1
      from public.referral_share_campaigns c
      where c.id = referral_touch_events.campaign_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "referral touch events admin select" on public.referral_touch_events;
create policy "referral touch events admin select"
  on public.referral_touch_events
  for select
  using (public.is_admin());

drop policy if exists "referral touch events service all" on public.referral_touch_events;
create policy "referral touch events service all"
  on public.referral_touch_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "referral attributions owner select" on public.referral_attributions;
create policy "referral attributions owner select"
  on public.referral_attributions
  for select
  using (auth.uid() = referrer_owner_id);

drop policy if exists "referral attributions admin select" on public.referral_attributions;
create policy "referral attributions admin select"
  on public.referral_attributions
  for select
  using (public.is_admin());

drop policy if exists "referral attributions service all" on public.referral_attributions;
create policy "referral attributions service all"
  on public.referral_attributions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "referral invites owner select" on public.referral_invites;
create policy "referral invites owner select"
  on public.referral_invites
  for select
  using (auth.uid() = owner_id);

drop policy if exists "referral invites owner insert" on public.referral_invites;
create policy "referral invites owner insert"
  on public.referral_invites
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "referral invites owner update" on public.referral_invites;
create policy "referral invites owner update"
  on public.referral_invites
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "referral invites owner delete" on public.referral_invites;
create policy "referral invites owner delete"
  on public.referral_invites
  for delete
  using (auth.uid() = owner_id);

drop policy if exists "referral invites admin select" on public.referral_invites;
create policy "referral invites admin select"
  on public.referral_invites
  for select
  using (public.is_admin());

drop policy if exists "referral invites service all" on public.referral_invites;
create policy "referral invites service all"
  on public.referral_invites
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.app_settings (key, value)
values
  ('enable_share_tracking', '{"enabled": true}'::jsonb),
  ('attribution_window_days', '{"days": 30}'::jsonb),
  ('store_ip_hash', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;
