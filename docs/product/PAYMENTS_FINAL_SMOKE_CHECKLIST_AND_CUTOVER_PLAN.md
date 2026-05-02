# Payments Final Smoke Checklist And Cutover Plan

This document is the final pre-live cutover package for payments. It is based on repo truth, current operator docs, and current official provider documentation.

Supporting repo docs:

- [docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md](/Users/olubusayoadewale/rentnow/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md)
- [docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md](/Users/olubusayoadewale/rentnow/docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md)

Supporting operator docs:

- [web/docs/BILLING.md](/Users/olubusayoadewale/rentnow/web/docs/BILLING.md)
- [web/docs/payments-v1-paystack.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-paystack.md)
- [web/docs/payments-v1-ops-vercel-cron.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-ops-vercel-cron.md)

Provider references used for cutover assumptions:

- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Paystack webhooks](https://paystack.com/docs/payments/webhooks/)

## A) Executive summary

Recommended initial live scope should stay deliberately staged.

Recommended first-wave live lanes:

1. Stripe subscriptions
2. Stripe shortlet payments for non-NGN lanes
3. Paystack shortlet payments for Nigeria-local NGN lanes

Recommended second-wave live lanes after first-wave stability and manual validation:

1. Paystack PAYG listing fees
2. Paystack canonical featured activation payments (`payments` + `featured_purchases`)

Recommended excluded scope at cutover:

1. Flutterwave
2. Legacy PAYG featured listing charges (`feature_purchases`) as a launch-critical lane
3. Broad Paystack subscription rollout without staged operator confirmation
4. Any non-NGN Paystack lane

Top 3 final go-live risks:

1. Paystack webhook ingress is still split across `/api/billing/webhook` and `/api/webhooks/paystack`, while Paystack documentation describes configuring a single webhook URL on the dashboard.
2. Paystack subscriptions remain less operationally clean than Stripe subscriptions even after the callback backstop hardening.
3. Legacy PAYG featured listing charges remain on a separate model from the canonical featured payment lane.

Launch recommendation by lane:

- launch Stripe lanes first
- launch Paystack shortlet next if Nigeria-local lane smoke is clean
- keep Paystack billing/featured lanes staged, not simultaneous-by-assumption
- keep Flutterwave out

## B) Lane-by-lane readiness table

| Lane | Audience | Provider | Trigger point | Status | Go-live recommendation | Blockers / notes |
| --- | --- | --- | --- | --- | --- | --- |
| Stripe subscriptions | tenant, landlord, agent | Stripe | `/dashboard/billing` -> `POST /api/billing/stripe/checkout` | Green | Launch in wave 1 | Requires live keys, live price IDs, billing webhook route, and successful live smoke |
| Stripe shortlet payments (non-NGN) | shortlet guest / tenant | Stripe | `/payments/shortlet/checkout` -> `POST /api/shortlet/payments/stripe/init` | Green | Launch in wave 1 | Requires shortlet webhook route, live key, and booking smoke |
| Paystack shortlet payments (NGN / Nigeria-local) | shortlet guest / tenant | Paystack | `/payments/shortlet/checkout` -> `POST /api/shortlet/payments/paystack/init` | Amber | Launch only after Stripe lanes and after Nigeria-local smoke | Shares Paystack webhook pressure with other Paystack lanes; verify/reconcile backstops help but do not remove ingress ambiguity |
| Paystack subscriptions | tenant, landlord, agent | Paystack | `/dashboard/billing` -> `POST /api/billing/paystack/initialize` | Amber | Stage after Stripe subscriptions, not same-day by default | Better than before because webhook and verify now converge, but overall Paystack ingress remains split |
| PAYG listing fees (NGN) | landlord, agent | Paystack | listing submit -> `POST /api/billing/checkout` | Amber | Enable only after dedicated listing-fee smoke and explicit webhook path decision | Depends on `/api/billing/webhook`; no equivalent reconcile safety net |
| Canonical featured activation payments | landlord, agent | Paystack | approved featured request -> `POST /api/payments/featured/initialize` | Amber | Enable after PAYG listing fees or alongside them only if Paystack ingress choice is explicit | Canonical model is now clear, but webhook route competes with other Paystack lanes |
| Legacy PAYG featured listing charges | landlord, agent | Paystack | listing feature flow -> `POST /api/billing/checkout` | Red | Keep out of initial live cutover | Secondary legacy lane on `feature_purchases`; weaker operator trust and no canonical-ledger status |
| Flutterwave subscriptions | tenant, landlord, agent | Flutterwave | `/dashboard/billing` -> Flutterwave init/verify | Red | Keep out | Explicitly out of initial live scope |

## C) Provider dashboard and webhook checklist

### Stripe

Required live secrets and settings:

- `STRIPE_SECRET_KEY_LIVE` or `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- live price IDs for all intended live plan/cadence combinations:
  - landlord monthly/yearly
  - agent monthly/yearly
  - tenant monthly/yearly
- `provider_settings.stripe_mode = live`

Required webhook endpoints:

1. Billing webhook
   - `https://<domain>/api/billing/stripe/webhook`
2. Shortlet webhook
   - `https://<domain>/api/webhooks/stripe`

Expected webhook signing secrets:

- billing route:
  - preferred: `STRIPE_BILLING_WEBHOOK_SECRET_LIVE`
  - acceptable fallback: `STRIPE_WEBHOOK_SECRET_LIVE`
- shortlet route:
  - preferred: `STRIPE_SHORTLET_WEBHOOK_SECRET_LIVE`
  - acceptable fallback: `STRIPE_WEBHOOK_SECRET_LIVE`

Dashboard configuration checks:

1. both webhook endpoints are registered in Stripe
2. each endpoint is subscribed only to the events the route actually consumes
3. each endpoint secret is copied into the correct env var
4. a live event delivery to each endpoint shows `2xx`

Callback / return URLs to verify:

- subscription checkout success: `/dashboard?stripe=success`
- subscription checkout cancel: `/dashboard?stripe=cancel`
- shortlet success return: `/payments/shortlet/return?bookingId=...&provider=stripe&session_id=...`
- shortlet cancel return: `/payments/shortlet/checkout?bookingId=...&cancelled=1`

### Paystack

Required live secrets and settings:

- canonical runtime source: stored provider keys in `provider_settings`
- `provider_settings.paystack_mode = live`
- live secret key present
- live public key present
- optional but preferred live webhook secret:
  - `PAYSTACK_WEBHOOK_SECRET_LIVE`

Explicit fallback precedence still in code:

1. stored provider settings for the active mode
2. mode-specific env keys
3. generic env keys
4. if live mode is selected but live keys are absent, fallback to test mode

Webhook endpoints currently present in repo:

1. billing/payg/subscription backstop route
   - `https://<domain>/api/billing/webhook`
2. featured v1 + shortlet route
   - `https://<domain>/api/webhooks/paystack`

### Paystack lane-to-webhook cutover matrix

| Lane | Provider | Webhook / verification path | Canonical / legacy / staged | Launch scope status | Operator note |
| --- | --- | --- | --- | --- | --- |
| Paystack subscriptions | Paystack | browser verify: `POST /api/billing/paystack/verify`; webhook backstop: `POST /api/billing/webhook` | staged | Amber | Do not treat this as the clean default recurring-billing lane. Stripe subscriptions remain the cleaner first-wave recurring lane. |
| Paystack shortlet NGN lanes | Paystack | `POST /api/webhooks/paystack` | staged | Amber | This is the first Paystack lane recommended after Stripe wave 1. If this lane is live, the Paystack dashboard webhook URL should match `/api/webhooks/paystack`. |
| Paystack NGN PAYG listing fees | Paystack | `POST /api/billing/webhook` | staged | Amber | This lane does not share ingress with shortlets. Do not enable it casually during a shortlet-first Paystack launch window. |
| Canonical featured activation payments (`payments` + `featured_purchases`) | Paystack | `POST /api/webhooks/paystack` | canonical, staged | Amber | This is the featured lane operators should trust first. It shares ingress with shortlets, not with billing/PAYG. |
| Legacy PAYG featured lane (`feature_purchases`) | Paystack | `POST /api/billing/webhook` | legacy | Red | Keep out of initial live cutover. Do not confuse it with the canonical featured activation lane. |
| Flutterwave subscription lane | Flutterwave | not part of Paystack ingress | out-of-scope | Red | Flutterwave remains out of the initial self-serve live scope. |

Critical cutover note:

- Paystack documentation describes configuring a single webhook URL on the dashboard.
- Repo truth still has two Paystack webhook ingress routes.
- Before broad Paystack live enablement, operators must make an explicit decision:
  - either stage Paystack lanes so only one ingress family is relied on at a time
  - or add a unified ingress in a later batch before enabling all Paystack lanes together

Operator-safe rule for staged cutover:

1. If the live Paystack window is shortlet-first or canonical-featured-first, configure the dashboard webhook for:
   - `https://<domain>/api/webhooks/paystack`
2. If the live Paystack window is subscription-backstop or PAYG-listing-first, configure the dashboard webhook for:
   - `https://<domain>/api/billing/webhook`
3. Do not assume one Paystack dashboard webhook URL safely covers both route families at the same time.
4. Do not describe canonical featured activation and legacy PAYG featured as equivalent lanes during launch operations.

Callback / return URLs to verify:

- subscription return: `/dashboard/billing?provider=paystack`
- shortlet return: `/payments/shortlet/return?bookingId=...&provider=paystack&reference=...`
- featured payment return: `/payments/featured/return?reference=...`
- PAYG listing return: `/dashboard/properties/<listingId>?payment=payg`
- PAYG featured return: `/host?featured=<listingId>`

Dashboard configuration checks:

1. live API keys belong to the correct business account
2. webhook URL choice is explicit and documented for the live window
3. a live signed webhook delivery is tested against the chosen ingress route
4. callback URLs resolve to the production domain

## D) Admin and operator checks

Run these before any live cutover.

### Global checks

1. Open `/admin/system` and `/api/admin/config-status`
2. Confirm provider modes match the intended cutover state
3. Confirm no provider is silently falling back from live to test
4. Confirm `NEXT_PUBLIC_SITE_URL` is the production domain

### Billing settings checks

Page:

- `/admin/settings/billing`

Verify:

1. Stripe mode is correct
2. Paystack mode is correct
3. stored Paystack live keys are present if Paystack live is intended
4. Flutterwave stays in test or unused state
5. Stripe billing and shortlet webhook readiness both show as ready for mode

### Billing ops checks

Page:

- `/admin/billing`

Verify:

1. Stripe live readiness banner is clean
2. recent Stripe webhook events are visible
3. provider payment events are visible for Paystack flows
4. manual override tooling is available for support fallback

### Payments ops checks

Page:

- `/admin/payments`

Trust model:

1. canonical featured payment lane = `payments` + `featured_purchases`
2. legacy PAYG featured lane = secondary only

Verify:

1. stuck count is zero or understood
2. receipts pending count is zero or understood
3. webhook events table is loading
4. reconcile actions succeed in test mode before live cutover

### Reconcile workflow checks

Workflow / routes:

- `.github/workflows/payments-reconcile.yml`
- `POST /api/jobs/payments/reconcile`
- `POST /api/internal/shortlet/reconcile-payments`

Verify:

1. `APP_URL` and `CRON_SECRET` are present in GitHub Actions
2. latest scheduled run is green
3. failure artifacts are empty or understood
4. manual curl trigger works against production with `x-cron-secret`

### Known legacy surfaces to treat as secondary

1. `feature_purchases` is not the canonical featured ledger
2. Flutterwave exists in code but is not part of live cutover
3. Paystack webhook routing is not yet one clean ingress across all lanes

## E) Manual smoke-test plan

Run each lane as a real end-to-end transaction in production mode with small amounts where possible.

### 1. Stripe subscriptions

Test setup:

- one tenant account
- one landlord or agent account
- Stripe live keys and live price IDs configured

Action:

1. open `/dashboard/billing`
2. choose Stripe checkout for the target tier
3. complete payment

Expected payment result:

- checkout succeeds and redirects to `/dashboard?stripe=success`

Expected billing / entitlement result:

- `profile_plans.billing_source = stripe`
- `plan_tier` matches purchase
- `valid_until` populated
- `stripe_status`, `stripe_subscription_id`, and `stripe_current_period_end` populated

Expected admin visibility:

- `/admin/billing` shows updated billing snapshot
- Stripe webhook event shows processed

Expected webhook / reconcile behaviour:

- `/api/billing/stripe/webhook` receives signed event and applies plan update

### 2. Stripe shortlet payments

Test setup:

- payable shortlet booking in non-NGN currency
- Stripe shortlet webhook configured

Action:

1. open `/payments/shortlet/checkout?bookingId=<id>`
2. continue with Stripe
3. complete payment

Expected payment result:

- returns to `/payments/shortlet/return`
- booking leaves payable state

Expected product result:

- `shortlet_payments.status = succeeded`
- booking becomes `pending` or `confirmed` per booking mode logic

Expected admin / operator result:

- shortlet reconcile route sees clean state

Expected webhook / reconcile behaviour:

- `/api/webhooks/stripe` receives success event
- reconcile job does not find the booking as stuck

### 3. Paystack shortlet payments

Test setup:

- payable Nigeria-local shortlet booking in `NGN`
- chosen Paystack webhook ingress decision documented

Action:

1. open shortlet checkout
2. continue with Paystack
3. complete payment

Expected payment result:

- returns to `/payments/shortlet/return?provider=paystack...`
- status polling eventually resolves

Expected product result:

- `shortlet_payments.status = succeeded`
- booking leaves payable state

Expected admin / operator result:

- shortlet reconcile route stays clean

Expected webhook / reconcile behaviour:

- either chosen Paystack webhook route receives the event
- or verify + reconcile closes the gap without manual data repair

### 4. Paystack subscriptions

Test setup:

- one user per intended role/cadence combination
- Paystack live keys configured

Action:

1. open `/dashboard/billing`
2. choose Paystack checkout
3. complete payment

Expected payment result:

- returns to `/dashboard/billing?provider=paystack`
- verify route completes without retry loop

Expected billing / entitlement result:

- `provider_payment_events` row moves to verified/processed
- `profile_plans.billing_source = paystack`
- `plan_tier` and `valid_until` update

Expected admin visibility:

- `/admin/billing` shows provider payment event and updated plan snapshot

Expected webhook / reconcile behaviour:

- browser verify succeeds
- if browser verify is skipped, billing webhook backstop should still finalize the event if the chosen Paystack ingress supports it

### 5. PAYG listing fees

Test setup:

- landlord/agent listing with no usable listing credits
- PAYG listing fee enabled

Action:

1. submit the listing
2. accept Paystack checkout
3. complete payment

Expected payment result:

- browser returns to listing/dashboard page

Expected product result:

- `listing_payments.status = paid`
- one listing credit is issued and consumed
- listing moves to `pending`

Expected admin visibility:

- provider payment-related listing state visible through listing and billing ops, even though there is no dedicated `/admin/payments` ledger for this lane

Expected webhook / reconcile behaviour:

- `/api/billing/webhook` must process `charge.success`
- if this webhook path is not the chosen live ingress, do not enable this lane yet

### 6. Canonical featured activation payments

Test setup:

- approved featured request ready for payment
- canonical Paystack lane in use

Action:

1. as host/agent, pay from the approved featured request flow
2. complete checkout

Expected payment result:

- return page polls to success or near-immediate activated state

Expected product result:

- `payments.status = succeeded`
- related `featured_purchases.status = activated`
- listing gets `featured_until`

Expected admin visibility:

- `/admin/payments` canonical table shows the payment
- webhook events and receipts are visible there

Expected webhook / reconcile behaviour:

- `/api/webhooks/paystack` should receive or reconcile should backfill successfully

### 7. Legacy PAYG featured listing charges

Launch handling:

- do not treat this as a required live cutover lane
- if it must be exercised, do it after canonical featured activation is stable and document that this is a legacy secondary flow

## F) Rollback and disable plan

### Global emergency stop

1. switch provider modes back to `test` in `/admin/settings/billing`
2. if needed, remove or rotate live secrets in hosting and provider dashboards
3. pause scheduled reconcile if it is acting on bad live traffic
4. update internal ops note with the exact stop time and lane disabled

### Stripe subscriptions rollback

Disable by:

1. setting Stripe mode back to test
2. disabling or removing live checkout entry points if needed
3. keeping webhook endpoints reachable until in-flight events are processed

After rollback, check:

1. no new live checkout sessions are being created
2. existing live customers are not accidentally downgraded by a mode misread
3. `/admin/billing` still shows prior events for audit

### Stripe shortlet rollback

Disable by:

1. moving Stripe mode back to test
2. optionally disabling shortlet provider availability if the lane must stop immediately

After rollback, check:

1. no new non-NGN shortlet bookings can open Stripe checkout
2. existing payable bookings are not stuck without an alternative provider message

### Paystack rollback

Disable by:

1. setting Paystack mode back to test
2. removing or rotating live keys if a hard stop is required
3. documenting which webhook route was active at the time of rollback

After rollback, check:

1. no live Paystack initialize calls succeed
2. no queue of paid-but-unapplied events is left unresolved
3. reconcile runs are reviewed for any in-flight references

### Rollback discipline for staged lanes

1. if Paystack billing lanes are not launched, do not switch them on ad hoc during incident response
2. keep `feature_purchases` clearly secondary in support communications
3. do not mix live and test screenshots or logs in the same triage trail

## G) Final launch recommendation

Launch first:

1. Stripe subscriptions
2. Stripe shortlet payments for non-NGN lanes

Launch next, after first-wave confirmation:

1. Paystack shortlet payments for NGN / Nigeria-local lanes

Launch later, only after explicit operator sign-off on Paystack ingress choice:

1. Paystack subscriptions
2. Paystack PAYG listing fees
3. Canonical featured activation payments

Keep out for now:

1. Flutterwave
2. Legacy PAYG featured listing charges as a launch-critical monetisation lane
3. Any non-NGN Paystack monetisation lane

## H) Final operator rule

Do not treat payment readiness as one global switch.

Cut over lane by lane.
If a lane cannot name:

1. its provider
2. its webhook or verify path
3. its admin visibility surface
4. its rollback step

that lane is not ready to go live.
