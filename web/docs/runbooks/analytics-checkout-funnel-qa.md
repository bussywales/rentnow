# Checkout funnel analytics QA

This runbook verifies the billing conversion funnel using the real production schema for `public.product_analytics_events`.

## Funnel events
- `billing_page_viewed`
- `plan_selected`
- `checkout_started`
- `checkout_succeeded`

## Emit points
- `billing_page_viewed`
  - emitted client-side from the billing page via `ProductEventTracker`
- `plan_selected`
  - emitted client-side from `PlansGrid` before checkout initialization
- `checkout_started`
  - emitted server-side in `/api/billing/stripe/checkout` after Stripe returns a Checkout Session
- `checkout_succeeded`
  - emitted server-side in Stripe webhook processing for `checkout.session.completed`
  - not emitted during admin replay, to avoid duplicate funnel rows

## Required properties
Where repo truth supports them, confirm:
- `market`
- `user_role`
- `plan_tier`
- `cadence`
- `billing_source`
- `currency`
- `amount`
- `provider`
- `provider_subscription_id`
- `properties ->> 'sourceEventId'` for webhook-sourced checkout success

## QA paths

### Tenant
1. Sign in as a tenant.
2. Open `/tenant/billing`.
3. Confirm `billing_page_viewed`.
4. Click a paid plan and confirm `plan_selected`.
5. Continue into Stripe Checkout and confirm `checkout_started`.
6. Complete checkout successfully.
7. Confirm `checkout_succeeded` after webhook processing.

### Landlord
1. Sign in as a landlord.
2. Open `/dashboard/billing`.
3. Repeat the same checks.

### Agent
1. Sign in as an agent.
2. Open `/dashboard/billing`.
3. Repeat the same checks.

## Where to verify

### GA4
- Realtime:
  - `billing_page_viewed`
  - `plan_selected`
  - `checkout_started`
  - `checkout_succeeded`

### First-party analytics table
Use the real column names:

```sql
select
  event_name,
  created_at,
  user_id,
  session_key,
  user_role,
  market,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  page_path,
  plan_tier,
  cadence,
  billing_source,
  currency,
  amount,
  provider,
  provider_subscription_id,
  properties
from public.product_analytics_events
where event_name in ('billing_page_viewed', 'plan_selected', 'checkout_started', 'checkout_succeeded')
order by created_at desc
limit 50;
```

### Billing/provider truth
After a successful checkout:
- `/admin/billing` should show Stripe ownership if the account is not intentionally manual
- `stripe_webhook_events` should show the corresponding Stripe lifecycle event
- `profile_plans` and `subscriptions` should reflect provider truth after webhook processing

## Expected interpretation
- `billing_page_viewed` without `plan_selected`
  - user reached pricing but did not choose a plan
- `plan_selected` without `checkout_started`
  - client intent happened, checkout initialization failed or navigation was interrupted
- `checkout_started` without `checkout_succeeded`
  - investigate Stripe Checkout completion and webhook processing
- `checkout_succeeded` with manual override still present in app state
  - conversion is real
  - investigate billing ownership / recovery, not funnel instrumentation

## SQL spot checks

Checkout funnel by role, market, cadence:
```sql
select
  event_name,
  user_role,
  market,
  cadence,
  count(*) as events
from public.product_analytics_events
where event_name in ('billing_page_viewed', 'plan_selected', 'checkout_started', 'checkout_succeeded')
  and created_at >= now() - interval '14 days'
group by 1, 2, 3, 4
order by 1, 2, 3, 4;
```

Checkout success rows only:
```sql
select
  created_at,
  user_id,
  user_role,
  market,
  plan_tier,
  cadence,
  billing_source,
  currency,
  amount,
  provider_subscription_id,
  properties
from public.product_analytics_events
where event_name = 'checkout_succeeded'
order by created_at desc
limit 20;
```

## Failure modes to escalate
- `checkout_started` never appears despite Stripe Checkout opening
- successful Stripe payments produce no `checkout_succeeded`
- `checkout_succeeded` appears only after replay instead of original webhook processing
- billing-funnel rows are missing `user_role`, `market`, `cadence`, or `plan_tier` for successful payments
