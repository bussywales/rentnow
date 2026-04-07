# Analytics instrumentation

This document defines the first serious analytics layer for PropatyHub / RentNow. The scope is intentionally narrow: acquisition attribution plus decision-grade product funnel events.

## Goals
- Understand traffic by source, medium, and campaign.
- Measure browse-to-intent conversion for tenants.
- Measure billing-page-to-checkout conversion.
- Measure host activation after payment.
- Keep event naming disciplined so reporting remains usable.

## Operational docs
- QA runbook: `web/docs/runbooks/analytics-qa-runbook.md`
- Checkout funnel QA: `web/docs/runbooks/analytics-checkout-funnel-qa.md`
- Dashboard spec: `web/docs/runbooks/analytics-traction-dashboard-spec.md`
- Reporting assembly plan: `web/docs/runbooks/analytics-reporting-assembly-plan.md`
- Looker Studio handoff: `web/docs/runbooks/looker-studio-handoff.md`
- Reporting metric dictionary: `web/docs/runbooks/reporting-metric-dictionary.md`
- UTM convention: `web/docs/runbooks/utm-conventions.md`

## Stack
- GA4 page + event forwarding when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.
- First-party event capture in `public.product_analytics_events`.
- UTM persistence in the `ph_attribution` cookie.

## Production schema truth
Use the real production column names when querying `public.product_analytics_events`:
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
- `properties`

Do not guess alternatives such as `occurred_at`, `session_id`, `role`, `source`, `medium`, `campaign`, `content`, or `path`.

## Required env vars
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - Enables GA4 page and event forwarding.
- `NEXT_PUBLIC_ANALYTICS_DEBUG`
  - Optional.
  - Set to `true` in preview/dev to log analytics payloads to the browser console.

## UTM rules
Supported parameters:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

Recommended medium vocabulary:
- `cpc`
- `paid_social`
- `social`
- `email`
- `referral`
- `display`
- `influencer`
- `affiliate`
- `organic`

Practical guidance:
- Keep `utm_source` platform-specific: `facebook`, `instagram`, `google`, `whatsapp`, `newsletter`.
- Keep `utm_campaign` stable across creative variants.
- Use `utm_content` for creative, audience, or hook variants.
- Use `utm_term` only where search-keyword style targeting exists.
- Always preserve landing-page URLs exactly as shipped in campaigns.

## Event naming conventions
Rules:
- Lowercase snake_case.
- Use verb-first names.
- Track committed user actions or trusted server outcomes, not cosmetic clicks.
- Avoid duplicating the same action across multiple layers.

Instrumented events:
- Search / browse
  - `search_performed`
  - `filter_applied`
  - `result_clicked`
- Listing engagement
  - `listing_viewed`
  - `listing_save_clicked`
  - `listing_unsave_clicked`
  - `shortlist_created`
  - `shortlist_shared`
- Tenant intent
  - `property_request_started`
  - `property_request_published`
  - `contact_submitted`
  - `viewing_request_submitted`
- Billing
  - `billing_page_viewed`
  - `plan_selected`
  - `checkout_started`
  - `checkout_succeeded`
- Host activation
  - `listing_created`
  - `listing_submitted_for_review`
  - `listing_published_live`

## Event property conventions
Only send properties already supported by repo truth.

Common properties:
- `pagePath`
- `market`
- `role`
- `intent`
- `city`
- `area`
- `propertyType`
- `listingId`
- `listingStatus`
- `planTier`
- `cadence`
- `billingSource`
- `currency`
- `amount`
- `provider`
- `providerSubscriptionId`
- `requestStatus`
- `shareChannel`
- `searchSource`
- `resultsCount`
- `filterCount`

Conventions:
- `amount` is stored in major currency units, not minor units.
- `market` should be the market country code when known, for example `UK` or `NG`.
- `role` should be normalized app role values only.
- `listingStatus` should reflect repo-truth listing lifecycle values.

## First dashboards to build
1. Traffic acquisition
- Sessions and key events by `utm_source` / `utm_medium` / `utm_campaign`.
- Landing pages by campaign.

2. Tenant demand funnel
- `search_performed` -> `result_clicked` -> `listing_viewed` -> `viewing_request_submitted` / `contact_submitted` / `property_request_published`.

3. Billing funnel
- `billing_page_viewed` -> `plan_selected` -> `checkout_started` -> `checkout_succeeded`.

4. Host activation funnel
- `checkout_succeeded` -> `listing_created` -> `listing_submitted_for_review` -> `listing_published_live`.

## What counts as traction
Start with signal that maps to marketplace health:
- repeat campaign traffic with meaningful tenant intent events
- listing-view to enquiry/viewing conversion
- paid host accounts creating and submitting listings quickly
- paid host accounts getting listings live
- landlord/agent checkout success that converts into listing activity, not just payment

Avoid vanity-first reporting:
- raw pageviews without intent
- traffic volume without action quality
- total signups without role-specific funnel progress

## QA checklist
Acquisition:
1. Open a campaign URL with UTMs.
2. Confirm the browser retains `ph_attribution` cookie.
3. Navigate to another page.
4. Confirm the same attribution stays attached to subsequent events.

Search / browse:
1. Perform a browse/search with real filters.
2. Confirm `search_performed` fires once per results view.
3. Confirm `filter_applied` fires when active filters exist.
4. Click a result and confirm `result_clicked`.

Listing engagement:
1. Open a property detail page and confirm `listing_viewed`.
2. Save a listing and confirm `listing_save_clicked`.
3. Remove it and confirm `listing_unsave_clicked`.
4. Create a collection and confirm `shortlist_created`.
5. Share a collection link or WhatsApp share and confirm `shortlist_shared`.

Tenant intent:
1. Open the property request creation page and confirm `property_request_started`.
2. Publish the request and confirm `property_request_published`.
3. Submit a buy enquiry and confirm `contact_submitted`.
4. Submit a viewing request and confirm `viewing_request_submitted`.

Billing:
1. Open the billing page and confirm `billing_page_viewed`.
2. Pick a plan and confirm `plan_selected`.
3. Start Stripe checkout and confirm `checkout_started`.
4. Complete checkout in Stripe and confirm `checkout_succeeded` after webhook processing.

Important checkout-funnel note:
- `billing_page_viewed` and `plan_selected` are client-side intent signals.
- `checkout_started` is emitted by the Stripe checkout API route after Stripe returns a Checkout Session URL.
- `checkout_succeeded` is emitted from Stripe webhook processing and is the source-of-truth conversion event.
- Admin replay should not create duplicate `checkout_succeeded` funnel rows.

Host activation:
1. Create a listing and confirm `listing_created`.
2. Submit a listing for review and confirm `listing_submitted_for_review`.
3. Auto-approve or admin-approve a listing and confirm `listing_published_live`.
