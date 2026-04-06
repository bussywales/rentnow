# First traction dashboard spec

This is the first stakeholder and operator dashboard specification for PropatyHub / RentNow. It is intentionally practical: acquisition, demand, billing conversion, and host activation.

## Production schema truth
This spec is grounded in the live first-party schema for `public.product_analytics_events`.

Use these real columns in reporting:
- `created_at`
- `event_name`
- `session_key`
- `user_id`
- `user_role`
- `market`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `page_path`
- `landing_path`
- `plan_tier`
- `cadence`
- `billing_source`
- `currency`
- `amount`
- `provider`
- `provider_subscription_id`
- `properties`

Do not build reporting against guessed names like `occurred_at`, `session_id`, `role`, `source`, `medium`, `campaign`, `content`, or `path`.

## Audience
- founders
- growth / acquisition operators
- marketplace operations
- billing / activation operators

## Reporting cadence
- daily check: acquisition, paid traffic quality, billing conversion, critical event integrity
- weekly check: demand conversion, paid host activation, early traction signals

## Time windows
- default: last 7 days
- comparison: previous 7 days
- executive view: last 28 days

## Section 1. Acquisition
Purpose:
- understand where traffic is coming from
- detect whether paid traffic is producing real marketplace actions
- watch direct / unattributed traffic drift

Metrics:
- sessions
- users
- new users
- sessions by `source / medium`
- sessions by `campaign`
- landing pages by session count
- paid vs organic session split
- direct / unattributed session share

Breakdowns:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `landing_path`
- market

Watchouts:
- high paid session volume with weak downstream actions
- large `direct / (none)` share during active paid campaigns
- one landing page receiving traffic but weak `result_clicked` or `listing_viewed`

## Section 2. Tenant demand
Purpose:
- measure whether seekers are moving beyond browsing

Metrics:
- `search_performed`
- `result_clicked`
- `listing_viewed`
- `listing_save_clicked`
- `property_request_started`
- `property_request_published`
- `contact_submitted`
- `viewing_request_submitted`

Derived rates:
- search -> result click rate
- result click -> listing view rate
- listing view -> save rate
- listing view -> contact rate
- listing view -> viewing request rate
- listing view -> property request publish rate

Breakdowns:
- market
- intent
- city
- property type
- source / medium
- campaign

Primary questions:
- are we getting real demand or just passive visits?
- which acquisition channels produce high-intent tenant actions?

## Section 3. Billing conversion
Purpose:
- measure whether billing pages and plans are converting into successful checkouts

Metrics:
- `billing_page_viewed`
- `plan_selected`
- `checkout_started`
- `checkout_succeeded`

Derived rates:
- billing page -> plan selected
- plan selected -> checkout started
- checkout started -> checkout succeeded

Breakdowns:
- role
- market
- plan tier
- cadence
- source / medium
- campaign

Primary questions:
- which roles are converting?
- which market and plan/cadence combinations stall?
- whether acquisition channels generate paid users, not just billing-page views

Implementation note:
- `billing_page_viewed` and `plan_selected` are client-intent events
- `checkout_started` is emitted after Stripe Checkout Session creation
- `checkout_succeeded` is webhook-sourced and should be treated as the source-of-truth conversion event

## Section 4. Host activation
Purpose:
- measure whether paid landlords and agents move into supply creation fast enough

Metrics:
- `listing_created`
- `listing_submitted_for_review`
- `listing_published_live`

Derived rates:
- paid host -> listing created
- listing created -> listing submitted
- listing submitted -> listing live
- checkout succeeded -> listing live

Breakdowns:
- role
- market
- city
- property type
- acquisition channel where available

Primary questions:
- are paid hosts reaching value?
- which role pays but stalls before listing submission?
- are newly paid hosts turning into live supply?

## Section 5. Efficiency / traction
Purpose:
- tie spend and funnel actions together

Metrics to show when ad spend data exists outside the app:
- cost per high-intent tenant action
- cost per property request
- cost per paid landlord
- cost per paid agent
- cost per live listing

Current repo-truth support:
- numerator side can be produced by joining ad spend externally to tracked source / medium / campaign
- denominator side is already available from:
  - tenant intent events
  - checkout success events
  - host activation events

Derived definitions:
- high-intent tenant action:
  - `property_request_published`
  - `contact_submitted`
  - `viewing_request_submitted`
- paid landlord:
  - `checkout_succeeded` where `role = landlord`
- paid agent:
  - `checkout_succeeded` where `role = agent`
- live listing:
  - `listing_published_live`

## Minimum dashboard tabs
1. Acquisition
2. Tenant demand funnel
3. Billing conversion funnel
4. Host activation funnel
5. Efficiency / traction

## Reporting build guidance

### GA4
Use GA4 for:
- sessions
- users
- new users
- source / medium / campaign trendlines
- landing page performance
- quick Realtime QA of custom events

Do not rely on GA4 alone for deep billing reconciliation.

### Looker Studio
Use Looker Studio for the first stakeholder dashboard:
- acquisition tables and trend charts
- tenant demand funnel
- billing conversion funnel
- host activation funnel
- efficiency rollups once ad spend is joined externally

Primary source tables/fields:
- `public.product_analytics_events`
- `created_at`
- `event_name`
- `user_role`
- `market`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `page_path`
- `landing_path`
- `plan_tier`
- `cadence`
- `billing_source`
- `amount`

### SQL-backed reporting
Use SQL-backed reporting where GA4 / Looker Studio alone are not enough:
- paid-to-listing-created
- paid-to-listing-live
- conversion joins from `checkout_succeeded` to host activation events
- campaign efficiency metrics joined to external spend
- operator-grade reconciliation of successful Stripe checkouts against analytics rows

## Minimum charts / tables
Acquisition:
- table: sessions by source / medium / campaign
- table: landing pages by campaign
- trend: sessions and users over time

Tenant demand:
- funnel: `search_performed -> result_clicked -> listing_viewed -> high-intent action`
- table: high-intent actions by source / medium
- table: high-intent actions by city / intent

Billing conversion:
- funnel: `billing_page_viewed -> plan_selected -> checkout_started -> checkout_succeeded`
- table: conversion by role and market
- table: checkout success by campaign

Host activation:
- funnel: `checkout_succeeded -> listing_created -> listing_submitted_for_review -> listing_published_live`
- table: paid host activation by role
- table: time-to-first-listing-live by role where computed offline

Efficiency:
- table: spend vs high-intent actions by campaign
- table: spend vs paid users by campaign
- table: spend vs live listings by campaign

## First stakeholder read order
1. Which channels are bringing traffic?
2. Which channels are producing high-intent tenant actions?
3. Which roles and markets are converting on billing?
4. Are paid hosts creating and publishing listings?
5. Is paid spend yielding traction, not just traffic?

## Red-flag conditions
- paid traffic up, high-intent actions flat
- billing page views up, checkout succeeds flat
- paid hosts up, listing submission flat
- strong tenant browse activity but weak contact/viewing/request actions
- direct / unattributed traffic too high during active campaign periods

## Green-light signals
- repeat campaign traffic with visible high-intent actions
- checkout success from landlord and agent lanes
- paid host -> live listing conversion improving week on week
- listing-view to contact/viewing/property-request rates holding or improving
