alter table public.listing_leads
  add column if not exists replied_at timestamptz null,
  add column if not exists viewing_requested_at timestamptz null,
  add column if not exists viewing_confirmed_at timestamptz null,
  add column if not exists off_platform_handoff_at timestamptz null;

create table if not exists public.shortlet_booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.shortlet_bookings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewee_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_role text not null,
  reviewee_role text not null,
  direction text not null default 'guest_to_host',
  visibility text not null default 'public',
  moderation_status text not null default 'published',
  rating int not null,
  body text not null,
  public_response text null,
  public_response_updated_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlet_booking_reviews_direction_chk check (direction in ('guest_to_host')),
  constraint shortlet_booking_reviews_visibility_chk check (visibility in ('public', 'internal')),
  constraint shortlet_booking_reviews_moderation_chk check (moderation_status in ('published', 'hidden')),
  constraint shortlet_booking_reviews_rating_chk check (rating between 1 and 5),
  constraint shortlet_booking_reviews_unique unique (booking_id, direction)
);

create index if not exists shortlet_booking_reviews_reviewee_created_idx
  on public.shortlet_booking_reviews (reviewee_user_id, created_at desc);
create index if not exists shortlet_booking_reviews_property_created_idx
  on public.shortlet_booking_reviews (property_id, created_at desc);

alter table public.shortlet_booking_reviews enable row level security;
alter table public.shortlet_booking_reviews force row level security;

grant select on public.shortlet_booking_reviews to anon, authenticated;
grant insert, update on public.shortlet_booking_reviews to authenticated;

drop policy if exists "shortlet booking reviews public read" on public.shortlet_booking_reviews;
create policy "shortlet booking reviews public read"
  on public.shortlet_booking_reviews
  for select
  to anon, authenticated
  using (visibility = 'public' and moderation_status = 'published');

drop policy if exists "shortlet booking reviews guest insert" on public.shortlet_booking_reviews;
create policy "shortlet booking reviews guest insert"
  on public.shortlet_booking_reviews
  for insert
  to authenticated
  with check (
    auth.uid() = reviewer_user_id
    and direction = 'guest_to_host'
    and visibility = 'public'
    and moderation_status = 'published'
    and exists (
      select 1
      from public.shortlet_bookings b
      where b.id = booking_id
        and b.property_id = shortlet_booking_reviews.property_id
        and b.guest_user_id = auth.uid()
        and b.host_user_id = shortlet_booking_reviews.reviewee_user_id
        and b.status = 'completed'
    )
  );

drop policy if exists "shortlet booking reviews host update response" on public.shortlet_booking_reviews;
create policy "shortlet booking reviews host update response"
  on public.shortlet_booking_reviews
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.shortlet_bookings b
      where b.id = booking_id
        and b.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.shortlet_bookings b
      where b.id = booking_id
        and b.host_user_id = auth.uid()
    )
  );

drop trigger if exists shortlet_booking_reviews_touch_updated_at on public.shortlet_booking_reviews;
create trigger shortlet_booking_reviews_touch_updated_at
before update on public.shortlet_booking_reviews
for each row execute function public.touch_updated_at();

alter table public.property_events drop constraint if exists property_events_event_type_check;
alter table public.property_events
  add constraint property_events_event_type_check
  check (event_type in (
    'property_view',
    'save_toggle',
    'lead_created',
    'lead_attributed',
    'lead_status_updated',
    'lead_note_added',
    'client_page_lead_viewed',
    'client_page_lead_status_updated',
    'listing_submit_attempted',
    'listing_submit_blocked_no_credits',
    'listing_payment_started',
    'listing_payment_succeeded',
    'listing_credit_consumed',
    'agent_network_shared',
    'viewing_requested',
    'enquiry_replied',
    'viewing_confirmed',
    'contact_exchange_attempted',
    'share_open',
    'featured_impression'
  ));
