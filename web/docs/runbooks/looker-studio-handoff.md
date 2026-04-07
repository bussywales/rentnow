# Looker Studio handoff

This is the exact handoff pack for assembling the first PropatyHub / RentNow stakeholder and operator dashboards in Looker Studio.

Use the real production schema and the reporting views created from it.

## 1. Data sources to create

Create these Looker Studio data sources in this order.

### Source 1. `PH - GA4 - Production`
Type:
- GA4 connector

Use for:
- sessions
- users
- new users
- acquisition trendlines
- landing-page traffic
- paid vs organic vs direct watch

### Source 2. `PH - Product Events - Production`
Type:
- PostgreSQL / Supabase direct connector

Connect to:
- `public.product_analytics_events`

Use for:
- raw event integrity checks
- operator QA tables
- event-level diagnostics

Do not rename core fields from the schema:
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

### Source 3. `PH - Reporting Checkout Funnel - Production`
Type:
- PostgreSQL / Supabase direct connector

Connect to:
- `reporting.checkout_funnel_daily`

### Source 4. `PH - Reporting Paid Host Activation - Production`
Type:
- PostgreSQL / Supabase direct connector

Connect to:
- `reporting.paid_host_activation_daily`

### Source 5. `PH - Reporting Campaign Conversion - Production`
Type:
- PostgreSQL / Supabase direct connector

Connect to:
- `reporting.campaign_conversion_daily`

## 2. Reports to build

Build two reports only.

### Report A. `PH Stakeholder Traction Dashboard`
Audience:
- founders
- growth leads
- marketplace leadership

### Report B. `PH Operator Funnel and QA Dashboard`
Audience:
- analytics QA
- billing ops
- marketplace ops

## 3. Stakeholder dashboard build

Default controls:
- date range
- market
- user role where available
- `utm_source`
- `utm_medium`
- `utm_campaign`

### Page 1. Executive summary
Charts:
1. Scorecards
   - source: split by source of truth
   - GA4: sessions, users, new users
   - SQL: high-intent actions, `checkout_succeeded`, paid landlords, paid agents, listings live
2. Time series
   - sessions vs high-intent actions vs `checkout_succeeded`

Caveats:
- label GA4 scorecards as GA4-derived
- label SQL scorecards as first-party-event-derived
- do not imply they share the same denominator

### Page 2. Acquisition
Charts:
1. Table
   - source: `PH - GA4 - Production`
   - dimensions: Session source / medium, Session campaign
   - metrics: Sessions, Users, New users
2. Table
   - source: `PH - GA4 - Production`
   - dimensions: Landing page, Session campaign
   - metrics: Sessions
3. Time series
   - source: `PH - GA4 - Production`
   - dimension: Date
   - metrics: Sessions, New users
4. Stacked bar
   - source: `PH - GA4 - Production`
   - dimension: Session medium grouped into paid / organic / direct / referral / email
   - metric: Sessions

### Page 3. Tenant demand
Charts:
1. Funnel
   - source: `PH - Reporting Campaign Conversion - Production`
   - stages: `search_performed_count`, `result_clicked_count`, `listing_viewed_count`, `high_intent_action_count`
2. Table
   - source: `PH - Reporting Campaign Conversion - Production`
   - dimensions: `utm_source`, `utm_medium`, `utm_campaign`, `market`
   - metrics: `listing_viewed_count`, `listing_save_clicked_count`, `property_request_published_count`, `contact_submitted_count`, `viewing_request_submitted_count`, `high_intent_action_count`
3. Time series
   - source: `PH - Reporting Campaign Conversion - Production`
   - dimension: `event_date_utc`
   - metrics: `listing_viewed_count`, `property_request_published_count`, `high_intent_action_count`

### Page 4. Billing conversion
Charts:
1. Funnel
   - source: `PH - Reporting Checkout Funnel - Production`
   - stages: `billing_page_viewed_count`, `plan_selected_count`, `checkout_started_count`, `checkout_succeeded_count`
2. Table
   - source: `PH - Reporting Checkout Funnel - Production`
   - dimensions: `user_role`, `market`, `plan_tier`, `cadence`
   - metrics: `billing_page_viewed_count`, `plan_selected_count`, `checkout_started_count`, `checkout_succeeded_count`
3. Time series
   - source: `PH - Reporting Checkout Funnel - Production`
   - dimension: `event_date_utc`
   - metrics: `checkout_started_count`, `checkout_succeeded_count`

Caveats:
- `billing_page_viewed_count` and `plan_selected_count` are client intent
- `checkout_succeeded_count` is the trustworthy revenue-funnel metric

### Page 5. Host activation
Charts:
1. Funnel
   - source: `PH - Reporting Paid Host Activation - Production`
   - stages: `paid_host_count`, `paid_host_created_count`, `paid_host_submitted_count`, `paid_host_live_count`
2. Table
   - source: `PH - Reporting Paid Host Activation - Production`
   - dimensions: `user_role`, `market`, `plan_tier`, `cadence`
   - metrics: `paid_host_count`, `paid_host_created_count`, `paid_host_submitted_count`, `paid_host_live_count`, `created_within_7d_count`, `live_within_14d_count`
3. Time series
   - source: `PH - Reporting Paid Host Activation - Production`
   - dimension: `paid_date_utc`
   - metrics: `paid_host_count`, `paid_host_live_count`

### Page 6. Efficiency / traction
Build this page only after external spend exists.

Charts:
1. Table
   - blended source: external spend + `PH - Reporting Campaign Conversion - Production`
   - dimensions: `utm_source`, `utm_medium`, `utm_campaign`, `market`
   - metrics: spend, `high_intent_action_count`, `paid_landlord_count`, `paid_agent_count`, `listing_published_live_count`
2. Scorecards
   - cost per high-intent action
   - cost per paid landlord
   - cost per paid agent
   - cost per live listing

## 4. Operator dashboard build

Default controls:
- date range
- market
- `user_role`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `event_name`

### Page 1. Attribution hygiene
Charts:
1. Table
   - source: `PH - Product Events - Production`
   - dimensions: `created_at` day, `utm_source`, `utm_medium`, `utm_campaign`, `landing_path`
   - metrics: record count
2. Table
   - source: `PH - Product Events - Production`
   - dimensions: `market`
   - metrics: rows with null `utm_source`, rows with null `utm_medium`, rows with null `utm_campaign`

### Page 2. Event integrity
Charts:
1. Table
   - source: `PH - Product Events - Production`
   - dimensions: `created_at` day, `event_name`, `market`, `user_role`
   - metrics: record count
2. Table
   - source: `PH - Product Events - Production`
   - dimensions: `event_name`
   - metrics: distinct `session_key`, distinct `user_id`

### Page 3. Billing funnel diagnostics
Charts:
1. Table
   - source: `PH - Reporting Checkout Funnel - Production`
   - dimensions: `event_date_utc`, `user_role`, `market`, `plan_tier`, `cadence`, `billing_source`, `currency`, `provider`
   - metrics: `billing_page_viewed_count`, `plan_selected_count`, `checkout_started_count`, `checkout_succeeded_count`
2. Table
   - source: `PH - Product Events - Production`
   - filter: `event_name = checkout_succeeded`
   - dimensions: `created_at`, `user_id`, `user_role`, `market`, `provider_subscription_id`, `billing_source`, `currency`, `amount`
   - metrics: record count

### Page 4. Host activation diagnostics
Charts:
1. Table
   - source: `PH - Reporting Paid Host Activation - Production`
   - dimensions: `paid_date_utc`, `user_role`, `market`, `utm_source`, `utm_medium`, `utm_campaign`
   - metrics: `paid_host_count`, `paid_host_created_count`, `paid_host_submitted_count`, `paid_host_live_count`, `created_within_7d_count`, `live_within_14d_count`
2. Table
   - source: `PH - Product Events - Production`
   - filter: `event_name in (listing_created, listing_submitted_for_review, listing_published_live)`
   - dimensions: `created_at`, `user_id`, `user_role`, `market`, `listing_id`, `listing_status`
   - metrics: record count

### Page 5. Market / role QA slices
Charts:
1. Pivot table
   - source: `PH - Product Events - Production`
   - rows: `event_name`
   - columns: `market`, `user_role`
   - metrics: record count
2. Pivot table
   - source: `PH - Reporting Checkout Funnel - Production`
   - rows: `market`
   - columns: `user_role`
   - metrics: `checkout_succeeded_count`

## 5. Metrics that must not be blended casually
Do not hand-blend these without explicit source labeling:
- GA4 sessions with first-party event counts into one single conversion percentage
- GA4 users with first-party paid host counts as if the identity models are identical
- revenue-truth metrics from GA4 alone
- webhook-sourced `checkout_succeeded` with client-intent-only billing counts without explanation

## 6. Directional vs exact
Operationally exact enough for dashboard use:
- first-party event counts from the reporting views
- `checkout_succeeded_count`
- paid-host activation counts

Directional only:
- top-of-funnel role splits where users are anonymous
- paid vs organic quality comparisons when some traffic is unattributed
- any blended GA4 + SQL rate unless the source split is shown clearly

## 7. Builder checklist
Before calling the report complete:
1. Confirm each data source name exactly matches the handoff pack.
2. Confirm `created_at`, `session_key`, `user_role`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `page_path` are used instead of guessed legacy names.
3. Confirm stakeholder charts use the reporting views where available, not ad hoc raw-table formulas.
4. Confirm operator charts preserve enough raw detail for QA.
5. Confirm every blended chart is labeled as blended.
