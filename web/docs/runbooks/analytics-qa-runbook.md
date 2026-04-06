# Analytics QA runbook

This runbook is the operator path for validating the PropatyHub / RentNow analytics foundation in preview and production-like environments.

## Preconditions
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in the target environment.
- The latest database migration has been applied, including `public.product_analytics_events`.
- Use a clean browser session or an incognito window for attribution tests.
- If you need client-side payload visibility in preview/dev, set `NEXT_PUBLIC_ANALYTICS_DEBUG=true`.

## What this validates
- GA4 tag is present
- first-party UTM attribution is preserved
- GA4 page views arrive
- core custom events arrive
- billing conversion events arrive
- host activation events arrive
- attribution leakage is visible when source or campaign tagging breaks

## Tools to use
- Browser devtools
- GA4 Realtime
- Supabase SQL editor or SQL console
- Internal app routes already present in repo truth:
  - `/admin/analytics`
  - `/help/admin/analytics`

## 1. GA4 tag presence
1. Open any public page such as `/properties`.
2. In devtools Network, filter for `gtag/js`.
3. Confirm a request to `https://www.googletagmanager.com/gtag/js?id=<MEASUREMENT_ID>`.
4. In the console, confirm `window.gtag` exists.

Expected:
- GA4 script loads once.
- `window.gtag` is defined.

Failure signals:
- no `gtag/js` request
- `window.gtag` missing
- page views never appear in GA4 Realtime

## 2. UTM attribution preservation
1. Open a URL like:
   - `/properties?utm_source=facebook&utm_medium=paid_social&utm_campaign=uk_launch&utm_content=creative_a`
2. Confirm the `ph_attribution` cookie is present.
3. Navigate to a property detail page and then to `/tenant/billing` or `/dashboard/billing`.
4. Confirm the same attribution persists on later events in `public.product_analytics_events`.

Expected:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `landing_path` persist after route changes.

SQL check:
```sql
select
  created_at,
  event_name,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  landing_path,
  page_path
from public.product_analytics_events
order by created_at desc
limit 20;
```

Attribution leakage signs:
- `utm_medium` present but `utm_source` null
- later conversion events have null UTM fields after a tagged landing
- `landing_path` missing on clearly tagged sessions
- large `direct / (none)` traffic share during paid campaigns

## 3. Page-view QA
1. Open a tagged landing page.
2. Confirm GA4 Realtime shows a `page_view`.
3. Navigate to a second route without a full reload.
4. Confirm a second `page_view` appears with the updated path.

Expected:
- route transitions produce page views
- `page_location` and `page_path` reflect the current route

## 4. Search / browse QA
1. Open `/properties`.
2. Apply a real search or filter combination.
3. Confirm:
   - `search_performed`
   - `filter_applied`
4. Click a result card and confirm `result_clicked`.
5. On the detail page, confirm `listing_viewed`.

Expected properties where available:
- `market`
- `role`
- `intent`
- `city`
- `propertyType`
- `resultsCount`
- `filterCount`
- `searchSource`

## 5. Save / shortlist QA
1. Save a listing from a property card or detail page.
2. Confirm `listing_save_clicked`.
3. Unsave it and confirm `listing_unsave_clicked`.
4. Create a collection and confirm `shortlist_created`.
5. Share a collection by copy link or WhatsApp and confirm `shortlist_shared`.

Expected properties where available:
- `listingId`
- `shareChannel`

## 6. Tenant intent QA
1. Start a property request and confirm `property_request_started`.
2. Publish the request and confirm `property_request_published`.
3. Submit a listing enquiry and confirm `contact_submitted`.
4. Submit a viewing request and confirm `viewing_request_submitted`.

Expected properties where available:
- `listingId`
- `intent`
- `city`
- `listingStatus`
- `requestStatus`

## 7. Billing conversion QA
Dedicated checkout funnel runbook:
- `web/docs/runbooks/analytics-checkout-funnel-qa.md`

1. Open `/tenant/billing` or `/dashboard/billing`.
2. Confirm `billing_page_viewed`.
3. Select a plan and confirm `plan_selected`.
4. Start checkout and confirm `checkout_started`.
5. Complete a real or controlled test checkout and confirm `checkout_succeeded` after webhook processing.

Expected properties where available:
- `market`
- `role`
- `planTier`
- `cadence`
- `billingSource`
- `currency`
- `amount`
- `provider`

Important:
- `checkout_succeeded` is server-side and should be treated as the source of truth.
- `checkout_succeeded` should be counted from the original webhook path, not from admin replay.
- If `checkout_started` appears but `checkout_succeeded` does not, check billing ops before assuming conversion failed.

## 8. Host activation QA
1. Create a listing and confirm `listing_created`.
2. Submit it for review and confirm `listing_submitted_for_review`.
3. Approve it through the normal flow and confirm `listing_published_live`.

Expected properties where available:
- `listingId`
- `listingStatus`
- `intent`
- `city`
- `propertyType`

## 9. GA4 Realtime verification checklist
- `page_view` arrives
- tagged sessions show the expected campaign
- one or more of:
  - `search_performed`
  - `listing_viewed`
  - `billing_page_viewed`
  - `checkout_started`
  - `checkout_succeeded`

If GA4 Realtime is missing custom events but the first-party table has them, the instrumentation is working and the issue is GA4 forwarding or GA processing delay.

## 10. SQL spot-check queries
Recent acquisition mix:
```sql
select
  coalesce(utm_source, '(direct)') as utm_source,
  coalesce(utm_medium, '(none)') as utm_medium,
  count(*) as events
from public.product_analytics_events
where created_at >= now() - interval '7 days'
group by 1, 2
order by events desc;
```

Billing funnel:
```sql
select
  event_name,
  user_role,
  market,
  count(*) as events
from public.product_analytics_events
where event_name in ('billing_page_viewed', 'plan_selected', 'checkout_started', 'checkout_succeeded')
  and created_at >= now() - interval '14 days'
group by 1, 2, 3
order by event_name, user_role, market;
```

Host activation:
```sql
select
  event_name,
  count(*) as events
from public.product_analytics_events
where event_name in ('listing_created', 'listing_submitted_for_review', 'listing_published_live')
  and created_at >= now() - interval '14 days'
group by 1
order by 1;
```

## 11. QA sign-off criteria
- GA4 tag loads
- tagged sessions preserve UTMs after route changes
- page views appear in GA4 Realtime
- at least one event from each family is confirmed:
  - search/browse
  - listing engagement
  - tenant intent
  - billing
  - host activation
- no obvious attribution leakage in first-party event rows

## 12. When to escalate
- page views missing completely
- `checkout_started` present but `checkout_succeeded` missing for successful payments
- large paid campaign traffic arriving as direct / unattributed
- core funnel events missing from both GA4 and `product_analytics_events`
