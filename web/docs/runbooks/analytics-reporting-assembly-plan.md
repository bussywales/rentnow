# Analytics reporting assembly plan

This plan defines the first serious reporting stack for PropatyHub / RentNow using the current live analytics and product schema.

It assumes the current production truth:
- GA4 is live enough for acquisition and Realtime event QA.
- First-party product events are written to `public.product_analytics_events`.
- Real schema names in `public.product_analytics_events` include `created_at`, `event_name`, `session_key`, `user_id`, `user_role`, `market`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `page_path`, `landing_path`, and `properties`.
- Production rows already confirm browse, listing-view, and billing-page events.
- `checkout_started` and `checkout_succeeded` instrumentation is now formalized, but revenue-funnel trust still depends on live QA of fresh checkout paths.

## 1. Step-0 source audit

### GA4 should supply
Use GA4 as the source of truth for acquisition and top-of-funnel web traffic:
- sessions
- users
- new users
- source / medium
- campaign
- content / creative variant where available
- landing pages
- Realtime page views and event smoke checks

Why:
- GA4 is built for sessionized acquisition reporting.
- Paid vs organic comparisons are easier there than in the first-party event table.
- Stakeholders already understand source / medium / campaign from GA4-style reports.

### `public.product_analytics_events` should supply
Use first-party SQL-backed reporting for product and revenue-funnel event truth:
- `search_performed`
- `filter_applied`
- `result_clicked`
- `listing_viewed`
- `listing_save_clicked`
- `listing_unsave_clicked`
- `shortlist_created`
- `shortlist_shared`
- `property_request_started`
- `property_request_published`
- `contact_submitted`
- `viewing_request_submitted`
- `billing_page_viewed`
- `plan_selected`
- `checkout_started`
- `checkout_succeeded`
- `listing_created`
- `listing_submitted_for_review`
- `listing_published_live`

Why:
- the table uses the app's real role, market, cadence, plan, billing, and listing properties
- webhook-sourced `checkout_succeeded` is stronger than GA4 for conversion truth
- host activation joins need `user_id` and event-level fields that GA4 is not good at reconciling

### Data neither source can fully answer yet
These remain incomplete or external:
- exact ad spend and cost metrics unless imported from Meta/Google/etc.
- true multi-touch attribution
- complete provider-reconciled revenue by campaign without joining Stripe/account truth
- long-term cohort retention and LTV
- exact paid-host-to-live-listing timing if billing truth needs account-state joins beyond event timestamps

### Split strategy recommendation
Use a split stack:
- GA4 for acquisition and sessionized marketing views
- SQL-backed first-party reporting for product funnel, billing funnel, and host activation
- Looker Studio as the presentation layer over both

Do not use:
- GA4 only: too weak for billing/provider truth and paid-host activation joins
- internal SQL only: too weak for sessions, new users, and campaign landing-page traffic hygiene

### Smallest serious first stack
1. GA4 data source in Looker Studio
2. Supabase/Postgres data source for `public.product_analytics_events`
3. One stakeholder report in Looker Studio
4. One operator report in Looker Studio
5. Minimal SQL-prepared views only where direct charting becomes awkward

### Where SQL-backed prep is required
Direct Looker Studio charts are fine for raw event counts.
SQL-backed preparation is needed for:
- checkout funnel summaries by role / market / cadence over time
- paid-host activation joins from `checkout_succeeded` to host listing events
- campaign efficiency views once external spend is joined
- operator-grade reconciliation when event-level duplicates or billing exceptions matter

## 2. Recommended reporting architecture

### GA4 layer
Purpose:
- acquisition performance
- landing-page quality
- top-of-funnel traffic monitoring
- Realtime QA

Recommended GA4 outputs:
- sessions by `Session source / medium`
- users and new users by campaign
- landing-page sessions by campaign
- channel split: paid social vs organic vs direct vs referral vs email

### First-party SQL layer
Purpose:
- product-event truth
- billing-event truth
- host activation truth
- operator reconciliation

Base table:
- `public.product_analytics_events`

Primary reporting dimensions from real schema:
- `created_at`
- `event_name`
- `event_family`
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
- `listing_id`
- `listing_status`
- `plan_tier`
- `cadence`
- `billing_source`
- `currency`
- `amount`
- `provider`
- `provider_subscription_id`
- `properties`

### Looker Studio layer
Purpose:
- stakeholder-facing weekly view
- operator-facing daily diagnostic view
- blended report shell without pretending the sources are interchangeable

### Blending guidance
Acceptable blends:
- GA4 acquisition trend + first-party product-event summary at source/medium/campaign level
- GA4 landing pages + first-party downstream event counts by campaign

Dangerous blends:
- session-to-user-to-event conversions that assume GA4 sessions and first-party `session_key` are identical
- exact billing conversion percentages built from mixed denominators without clearly labeling source differences
- provider-truth revenue reporting built from GA4 only

## 3. Exact Looker Studio report structure

## Stakeholder dashboard
Audience:
- founders
- growth operators
- marketplace leadership

Default filters:
- date range: last 7 days
- comparison: previous 7 days
- market
- user role
- utm_source
- utm_medium
- utm_campaign

### Section 1. Executive summary
Charts/tables:
- scorecards: sessions, listing views, high-intent actions, checkout succeeded, paid hosts, listings live
- scorecards: paid landlord, paid agent, property requests published
- trendline: sessions vs high-intent actions vs checkout succeeded over time

Source of truth:
- GA4 for sessions
- first-party SQL for events and paid-host metrics

Dimensions:
- day

Metrics:
- sessions
- `listing_viewed`
- high-intent actions
- `checkout_succeeded`
- paid landlord count
- paid agent count
- `listing_published_live`

Known caveats:
- executive scorecards mix GA4 and first-party sources
- session denominators and first-party event counts should be labeled by source

### Section 2. Acquisition
Charts/tables:
- table: sessions by `session source / medium`
- table: sessions by campaign and landing page
- time series: sessions and new users by day
- stacked bar: paid vs organic vs direct / unattributed

Source of truth:
- GA4 only

Dimensions:
- session source / medium
- session campaign
- landing page
- date

Metrics:
- sessions
- users
- new users
- engaged sessions if available in GA4

Required filters:
- date range
- campaign
- source / medium
- landing page

Known caveats:
- unattributed or direct spikes can reflect weak UTM discipline, not necessarily channel performance

### Section 3. Tenant demand
Charts/tables:
- funnel: `search_performed -> result_clicked -> listing_viewed -> high-intent action`
- table: high-intent actions by `utm_source`, `utm_medium`, `utm_campaign`
- table: listing views and saves by market / city / intent
- time series: listing views vs property requests published

Source of truth:
- first-party SQL

Dimensions:
- `market`
- `user_role`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `city`
- `intent`
- date

Metrics:
- `search_performed`
- `result_clicked`
- `listing_viewed`
- `listing_save_clicked`
- `property_request_started`
- `property_request_published`
- `contact_submitted`
- `viewing_request_submitted`
- high-intent actions = `property_request_published + contact_submitted + viewing_request_submitted`

Required filters:
- market
- city
- source / medium
- campaign
- intent

Known caveats:
- unauthenticated traffic can produce null `user_role`
- some listing engagement happens before sign-in, so role breakdowns are directional at top-of-funnel stages

### Section 4. Billing conversion
Charts/tables:
- funnel: `billing_page_viewed -> plan_selected -> checkout_started -> checkout_succeeded`
- table: checkout funnel by `user_role`
- table: checkout funnel by `market` and `cadence`
- time series: checkout started vs checkout succeeded by day

Source of truth:
- first-party SQL

Dimensions:
- `user_role`
- `market`
- `plan_tier`
- `cadence`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- date

Metrics:
- `billing_page_viewed`
- `plan_selected`
- `checkout_started`
- `checkout_succeeded`

Required filters:
- user_role
- market
- cadence
- campaign

Known caveats:
- `billing_page_viewed` and `plan_selected` are client intent signals
- `checkout_succeeded` is the trustworthy conversion event because it is webhook-sourced
- do not interpret admin replay as a conversion source

### Section 5. Host activation
Charts/tables:
- funnel: `checkout_succeeded -> listing_created -> listing_submitted_for_review -> listing_published_live`
- cohort table: paid host event date vs first listing created date
- table: paid hosts by role and whether they reached listing submitted/live
- time series: listing created, submitted, live by day

Source of truth:
- first-party SQL, with SQL-prepared joins preferred for paid-host activation rates

Dimensions:
- `user_role`
- `market`
- date
- city
- property_type

Metrics:
- `checkout_succeeded`
- `listing_created`
- `listing_submitted_for_review`
- `listing_published_live`
- paid-host-created rate
- paid-host-live rate

Required filters:
- role in (`landlord`, `agent`)
- market
- campaign where attribution is present

Known caveats:
- direct charting from raw events is fine for counts, but paid-host activation rates are cleaner from a SQL-prepared summary view

### Section 6. Efficiency / traction
Charts/tables:
- table: source / medium / campaign with sessions, high-intent actions, paid landlords, paid agents, live listings
- scorecards: cost per high-intent action, cost per paid landlord, cost per paid agent, cost per live listing

Source of truth:
- blended Looker Studio view only after external ad spend is imported
- SQL-prepared summary strongly recommended

Dimensions:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- market

Metrics:
- spend
- high-intent actions
- paid landlords
- paid agents
- live listings
- derived cost metrics

Required filters:
- date range
- campaign
- market

Known caveats:
- spend is not present in repo truth today
- this section is not trustworthy until ad spend is imported consistently

## Operator dashboard
Audience:
- analytics QA
- billing ops
- marketplace ops

Sections:
1. attribution hygiene
2. event integrity
3. billing funnel diagnostics
4. host activation diagnostics
5. market / role QA slices

Recommended operator charts:
- table: raw event counts by `event_name`, `market`, `user_role`, day
- table: null-rate watch for `utm_source`, `utm_medium`, `utm_campaign`, `landing_path`
- table: billing events by `provider`, `billing_source`, `currency`, `cadence`
- table: `checkout_succeeded` rows with `provider_subscription_id`, `amount`, `currency`, `user_role`, `market`
- table: listing activation rows by `listing_status`, city, property type

## 4. Report build plan

Build order:
1. Connect GA4 as `PH - GA4 - Production`
2. Connect Supabase/Postgres first-party events as `PH - Product Events - Production`
3. Build stakeholder Acquisition tab first
4. Build stakeholder Billing conversion tab second
5. Build stakeholder Tenant demand tab third
6. Build operator Event integrity tab fourth
7. Add Host activation charts after SQL-prepared summaries exist
8. Add Efficiency / traction after spend import exists

Safe immediately:
- GA4 sessions/users/new users/source-medium/campaign/landing-page charts
- raw first-party event counts by day / role / market / campaign
- tenant demand funnels from first-party events
- billing conversion funnel counts from first-party events

Should wait for SQL prep:
- paid-host-to-live rates
- exact checkout-success to listing-live elapsed-time analysis
- campaign efficiency metrics with spend
- operator reconciliation of billing/account-state exceptions

Naming conventions:
- reports:
  - `PH Stakeholder Traction Dashboard`
  - `PH Operator Funnel and QA Dashboard`
- data sources:
  - `PH - GA4 - Production`
  - `PH - Product Events - Production`
  - `PH - Reporting Views - Production`
- blended charts:
  - prefix with `Blend:` only when sources are mixed

## 5. Minimum SQL / derived reporting needs

Do not build a warehouse yet.
Build only these minimum reporting views when direct charts stop being enough.

### View 1: `reporting.checkout_funnel_daily`
Purpose:
- daily billing funnel by role / market / cadence / campaign

Suggested grain:
- day
- `user_role`
- `market`
- `plan_tier`
- `cadence`
- `utm_source`
- `utm_medium`
- `utm_campaign`

Measures:
- `billing_page_viewed_count`
- `plan_selected_count`
- `checkout_started_count`
- `checkout_succeeded_count`

### View 2: `reporting.paid_host_activation_daily`
Purpose:
- paid-host activation from checkout to listing activity

Suggested grain:
- paid host `user_id`
- paid date
- `user_role`
- `market`
- acquisition fields where present

Measures / flags:
- first `checkout_succeeded_at`
- first `listing_created_at`
- first `listing_submitted_for_review_at`
- first `listing_published_live_at`
- `created_within_7d`
- `live_within_14d`

### View 3: `reporting.campaign_conversion_daily`
Purpose:
- source / medium / campaign summary across tenant demand, billing, and host activation

Suggested grain:
- day
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `market`

Measures:
- listing views
- high-intent actions
- checkout succeeded
- paid landlords
- paid agents
- live listings attributed by first-touch session fields where available

## 6. Stakeholder vs operator split

### Stakeholder dashboard
Principles:
- simple
- executive
- trend-focused
- decision-oriented

Should answer:
- where traffic is coming from
- which channels produce real demand
- which roles are paying
- whether paid hosts are turning into supply

Should avoid:
- raw event dumps
- provider diagnostics
- QA-only anomaly tables

### Operator dashboard
Principles:
- diagnostic
- event-level
- QA-friendly
- anomaly-sensitive

Should answer:
- are UTMs breaking
- are funnel events missing
- is checkout success appearing after webhook processing
- are host activation events firing by role and market
- do market/role slices look internally coherent

## 7. Metric definitions
- session:
  - GA4 session
- traffic source / medium:
  - GA4 acquisition dimensions, or first-party `utm_source` / `utm_medium` for event-level reporting
- attributed visit:
  - a visit with non-null `utm_source` and `utm_medium`
- listing view:
  - one `listing_viewed` event row in `public.product_analytics_events`
- high-intent action:
  - one of `property_request_published`, `contact_submitted`, or `viewing_request_submitted`
- checkout started:
  - one `checkout_started` event emitted after the Stripe checkout API route creates a Checkout Session
- checkout succeeded:
  - one webhook-sourced `checkout_succeeded` event row from original Stripe webhook processing
- paid host:
  - a `checkout_succeeded` row where `user_role` is `landlord` or `agent`
- listing submitted:
  - one `listing_submitted_for_review` event row
- listing live:
  - one `listing_published_live` event row
- cost per high-intent action:
  - external ad spend divided by high-intent actions
- cost per paid landlord:
  - external ad spend divided by `checkout_succeeded` where `user_role = landlord`
- cost per paid agent:
  - external ad spend divided by `checkout_succeeded` where `user_role = agent`
- cost per live listing:
  - external ad spend divided by `listing_published_live`

## 8. QA / trust checklist
Stakeholders should trust the report only when:
- GA4 tag is loading in production
- UTM-tagged visits preserve attribution across route changes
- first-party rows show expected `utm_*` values on later funnel events
- billing funnel shows real `checkout_succeeded` rows from webhook processing
- host activation events are present for real paid hosts

Known limitations to disclose:
- GA4 and first-party events serve different purposes and will not match perfectly row-for-row
- unattributed traffic can still leak through untagged links
- cost metrics are blocked until external spend is imported
- `checkout_succeeded` is authoritative for successful Stripe checkouts, but final billing state still belongs to billing ops if account recovery is needed

Directional vs exact:
- directional:
  - top-of-funnel role splits on anonymous traffic
  - blended GA4 + first-party rate comparisons
- operationally exact:
  - first-party raw event counts
  - billing webhook-sourced checkout success counts
  - host activation event counts
