# Reporting metric dictionary

This dictionary defines the first reporting pack for PropatyHub / RentNow.

## Source labels
- GA4:
  - acquisition and sessions
- First-party SQL:
  - `public.product_analytics_events`
  - `reporting.checkout_funnel_daily`
  - `reporting.paid_host_activation_daily`
  - `reporting.campaign_conversion_daily`

## Core definitions

### Session
Definition:
- one GA4 session

Source:
- GA4 only

### Attributed session
Definition:
- a GA4 session with campaign/source/medium attribution present, or an event row with non-null `utm_source` and `utm_medium` when working at event level

Source:
- GA4 for session reporting
- first-party SQL for event-level attribution checks

### Listing view
Definition:
- one `listing_viewed` event row

Source:
- first-party SQL

### High-intent action
Definition:
- one of:
  - `property_request_published`
  - `contact_submitted`
  - `viewing_request_submitted`

Source:
- first-party SQL

### Checkout started
Definition:
- one `checkout_started` row emitted after Stripe Checkout Session creation

Source:
- first-party SQL

### Checkout succeeded
Definition:
- one webhook-sourced `checkout_succeeded` row from original Stripe webhook processing

Source:
- first-party SQL

### Paid host
Definition:
- one `checkout_succeeded` row or aggregated reporting-view count where `user_role` is `landlord` or `agent`

Source:
- first-party SQL

### Listing submitted
Definition:
- one `listing_submitted_for_review` event row

Source:
- first-party SQL

### Listing live
Definition:
- one `listing_published_live` event row

Source:
- first-party SQL

### Conversion rate
Definition:
- numerator divided by denominator, where both sides come from the same source family unless the chart is explicitly labeled as blended

Examples:
- `checkout_succeeded_count / checkout_started_count`
- `high_intent_action_count / listing_viewed_count`

Source:
- first-party SQL preferred for product and billing funnels

### Cost per high-intent action
Definition:
- external spend / high-intent actions

Requires:
- imported spend outside current repo truth

### Cost per paid landlord
Definition:
- external spend / `checkout_succeeded` where `user_role = landlord`

Requires:
- imported spend outside current repo truth

### Cost per paid agent
Definition:
- external spend / `checkout_succeeded` where `user_role = agent`

Requires:
- imported spend outside current repo truth

### Cost per live listing
Definition:
- external spend / `listing_published_live`

Requires:
- imported spend outside current repo truth

## Trust notes
- `billing_page_viewed` and `plan_selected` are intent metrics, not payment truth.
- `checkout_succeeded` is the trustworthy billing conversion metric.
- GA4 sessions and first-party event rows are not interchangeable denominators.
- Anonymous traffic can produce null `user_role` in first-party events.
