-- Minimal reporting views for Looker Studio stakeholder and operator dashboards.

create schema if not exists reporting;

comment on schema reporting is 'Read-only reporting views for analytics, billing funnel, and host activation summaries.';

revoke all on schema reporting from public;
grant usage on schema reporting to service_role;

create or replace view reporting.checkout_funnel_daily as
select
  (pae.created_at at time zone 'UTC')::date as event_date_utc,
  pae.user_role,
  pae.market,
  pae.plan_tier,
  pae.cadence,
  pae.billing_source,
  pae.currency,
  pae.provider,
  pae.utm_source,
  pae.utm_medium,
  pae.utm_campaign,
  pae.utm_content,
  pae.landing_path,
  count(*) filter (where pae.event_name = 'billing_page_viewed')::bigint as billing_page_viewed_count,
  count(*) filter (where pae.event_name = 'plan_selected')::bigint as plan_selected_count,
  count(*) filter (where pae.event_name = 'checkout_started')::bigint as checkout_started_count,
  count(*) filter (where pae.event_name = 'checkout_succeeded')::bigint as checkout_succeeded_count
from public.product_analytics_events as pae
where pae.event_name in ('billing_page_viewed', 'plan_selected', 'checkout_started', 'checkout_succeeded')
group by
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13;

comment on view reporting.checkout_funnel_daily is 'UTC-daily billing funnel counts from first-party product analytics. Grain: date + role + market + plan + cadence + attribution.';

create or replace view reporting.paid_host_activation_daily as
with first_paid_host_checkout as (
  select
    ranked.user_id,
    ranked.user_role,
    ranked.market,
    ranked.plan_tier,
    ranked.cadence,
    ranked.billing_source,
    ranked.currency,
    ranked.amount,
    ranked.provider,
    ranked.provider_subscription_id,
    ranked.utm_source,
    ranked.utm_medium,
    ranked.utm_campaign,
    ranked.utm_content,
    ranked.landing_path,
    ranked.created_at as checkout_succeeded_at
  from (
    select
      pae.user_id,
      pae.user_role,
      pae.market,
      pae.plan_tier,
      pae.cadence,
      pae.billing_source,
      pae.currency,
      pae.amount,
      pae.provider,
      pae.provider_subscription_id,
      pae.utm_source,
      pae.utm_medium,
      pae.utm_campaign,
      pae.utm_content,
      pae.landing_path,
      pae.created_at,
      row_number() over (
        partition by pae.user_id, pae.user_role
        order by pae.created_at asc, pae.id asc
      ) as rn
    from public.product_analytics_events as pae
    where pae.event_name = 'checkout_succeeded'
      and pae.user_id is not null
      and pae.user_role in ('landlord', 'agent')
  ) as ranked
  where ranked.rn = 1
),
first_host_activation as (
  select
    checkout.user_id,
    checkout.user_role,
    min(case when pae.event_name = 'listing_created' then pae.created_at end) as first_listing_created_at,
    min(case when pae.event_name = 'listing_submitted_for_review' then pae.created_at end) as first_listing_submitted_at,
    min(case when pae.event_name = 'listing_published_live' then pae.created_at end) as first_listing_live_at
  from first_paid_host_checkout as checkout
  left join public.product_analytics_events as pae
    on pae.user_id = checkout.user_id
   and pae.user_role = checkout.user_role
   and pae.event_name in ('listing_created', 'listing_submitted_for_review', 'listing_published_live')
   and pae.created_at >= checkout.checkout_succeeded_at
  group by checkout.user_id, checkout.user_role
)
select
  (checkout.checkout_succeeded_at at time zone 'UTC')::date as paid_date_utc,
  checkout.user_role,
  checkout.market,
  checkout.plan_tier,
  checkout.cadence,
  checkout.billing_source,
  checkout.currency,
  checkout.provider,
  checkout.utm_source,
  checkout.utm_medium,
  checkout.utm_campaign,
  checkout.utm_content,
  checkout.landing_path,
  count(*)::bigint as paid_host_count,
  count(*) filter (where activation.first_listing_created_at is not null)::bigint as paid_host_created_count,
  count(*) filter (where activation.first_listing_submitted_at is not null)::bigint as paid_host_submitted_count,
  count(*) filter (where activation.first_listing_live_at is not null)::bigint as paid_host_live_count,
  count(*) filter (
    where activation.first_listing_created_at is not null
      and activation.first_listing_created_at <= checkout.checkout_succeeded_at + interval '7 days'
  )::bigint as created_within_7d_count,
  count(*) filter (
    where activation.first_listing_live_at is not null
      and activation.first_listing_live_at <= checkout.checkout_succeeded_at + interval '14 days'
  )::bigint as live_within_14d_count
from first_paid_host_checkout as checkout
left join first_host_activation as activation
  on activation.user_id = checkout.user_id
 and activation.user_role = checkout.user_role
group by
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13;

comment on view reporting.paid_host_activation_daily is 'UTC-daily paid-host activation summary. Base set is the first successful paid checkout per landlord or agent, joined to first listing creation/submission/live events after payment.';

create or replace view reporting.campaign_conversion_daily as
select
  (pae.created_at at time zone 'UTC')::date as event_date_utc,
  pae.market,
  pae.utm_source,
  pae.utm_medium,
  pae.utm_campaign,
  pae.utm_content,
  pae.landing_path,
  count(*) filter (where pae.event_name = 'search_performed')::bigint as search_performed_count,
  count(*) filter (where pae.event_name = 'result_clicked')::bigint as result_clicked_count,
  count(*) filter (where pae.event_name = 'listing_viewed')::bigint as listing_viewed_count,
  count(*) filter (where pae.event_name = 'listing_save_clicked')::bigint as listing_save_clicked_count,
  count(*) filter (where pae.event_name = 'property_request_published')::bigint as property_request_published_count,
  count(*) filter (where pae.event_name = 'contact_submitted')::bigint as contact_submitted_count,
  count(*) filter (where pae.event_name = 'viewing_request_submitted')::bigint as viewing_request_submitted_count,
  count(*) filter (where pae.event_name = 'billing_page_viewed')::bigint as billing_page_viewed_count,
  count(*) filter (where pae.event_name = 'plan_selected')::bigint as plan_selected_count,
  count(*) filter (where pae.event_name = 'checkout_started')::bigint as checkout_started_count,
  count(*) filter (where pae.event_name = 'checkout_succeeded')::bigint as checkout_succeeded_count,
  count(*) filter (where pae.event_name = 'checkout_succeeded' and pae.user_role = 'landlord')::bigint as paid_landlord_count,
  count(*) filter (where pae.event_name = 'checkout_succeeded' and pae.user_role = 'agent')::bigint as paid_agent_count,
  count(*) filter (where pae.event_name = 'listing_created')::bigint as listing_created_count,
  count(*) filter (where pae.event_name = 'listing_submitted_for_review')::bigint as listing_submitted_for_review_count,
  count(*) filter (where pae.event_name = 'listing_published_live')::bigint as listing_published_live_count,
  count(*) filter (
    where pae.event_name in ('property_request_published', 'contact_submitted', 'viewing_request_submitted')
  )::bigint as high_intent_action_count
from public.product_analytics_events as pae
where pae.event_name in (
  'search_performed',
  'result_clicked',
  'listing_viewed',
  'listing_save_clicked',
  'property_request_published',
  'contact_submitted',
  'viewing_request_submitted',
  'billing_page_viewed',
  'plan_selected',
  'checkout_started',
  'checkout_succeeded',
  'listing_created',
  'listing_submitted_for_review',
  'listing_published_live'
)
group by
  1, 2, 3, 4, 5, 6, 7;

comment on view reporting.campaign_conversion_daily is 'UTC-daily campaign summary from first-party product analytics. Grain: date + market + UTM attribution + landing path.';

grant select on reporting.checkout_funnel_daily to service_role;
grant select on reporting.paid_host_activation_daily to service_role;
grant select on reporting.campaign_conversion_daily to service_role;
