# Revenue Model And Payment Stages

This document explains how PropatyHub currently makes money in repo truth, when users are charged, what each payment unlocks, and which monetisation lanes are live, amber, manual, or planned.

This is a code-informed document. It reflects the current repository state and the existing payment readiness decisions, not a claim that every payment lane is already safe to enable live.

Primary supporting sources:

- [docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)

## Executive Summary

PropatyHub currently has four real monetisation families in the codebase:

1. optional subscriptions for tenants, landlords, and agents
2. pay-as-you-go listing submission fees
3. featured placement payments
4. shortlet booking payments

There is also one important non-revenue billing control:

- admin manual plan overrides

Current repo truth:

- `Stripe` is the strongest recurring-billing lane and the preferred international provider lane.
- `Paystack` owns most one-off Nigeria-local `NGN` monetisation paths in the repo today.
- `Flutterwave` exists for subscription initialize/verify only, but is explicitly out of the initial live scope.
- the codebase can take money through multiple paths, but not every path should be presented as fully live until the remaining pre-live hardening work is complete.

Biggest monetisation ambiguities still open:

1. subscriptions are implemented across three providers, but only Stripe is close to disciplined initial live scope
2. PAYG and featured monetisation are mostly Paystack-only and `NGN`-biased
3. shortlet payments are implemented, but the audited repo does not yet present a canonical host payout / platform take-rate model in the same level of clarity as checkout collection
4. some UI plan marketing copy is broader than the hard entitlement model, so stakeholder material should follow backend-enforced unlocks, not just card copy

## Revenue Stream Inventory

| Revenue stream | Who pays | When they pay | Provider(s) | Current status | What payment unlocks |
| --- | --- | --- | --- | --- | --- |
| Subscription plan upgrade | tenant, landlord, agent | when user upgrades from `/dashboard/billing` | Stripe, Paystack, Flutterwave | `AMBER` overall; Stripe strongest, Paystack weaker, Flutterwave out of initial live scope | updates `profile_plans`, sets `billing_source`, sets `valid_until`, and can issue listing/featured credits for paid host plans |
| PAYG listing submission fee | landlord, agent | when submitting a listing without available listing credits or trial credits | Paystack | `AMBER` | one listing credit is inserted and immediately consumed; listing moves into the review pipeline (`pending`) |
| PAYG featured listing fee | landlord, agent | when featuring a live listing without available featured credits | Paystack | `AMBER` | one featured credit is inserted and immediately consumed; listing becomes featured until configured expiry |
| Featured request activation payment | landlord, agent, admin test path | after an approved featured request is ready to activate | Paystack | `AMBER` | creates payment + purchase records and activates the approved featured purchase on success |
| Shortlet booking payment | guest / tenant booking a shortlet | when continuing checkout for a payable booking | Stripe or Paystack based on shortlet routing | `AMBER`, strongest near-live charge lane | marks `shortlet_payments` successful and advances booking state through post-payment booking logic |
| Admin manual plan override | admin only | manual support or ops action, not a customer checkout | none | `MANUAL`, not revenue | changes plan access directly without charging the user |

## Payment Stages Across The Product

Most monetised flows follow the same basic stage model, even though they use different providers and tables.

### Stage 1: User initiates a monetised action

Examples:

- upgrade plan from `/dashboard/billing`
- submit listing without credits
- feature a listing without credits
- pay to activate an approved featured request
- pay for a shortlet booking

### Stage 2: Server initializes provider checkout

Examples:

- Stripe checkout session creation
- Paystack transaction initialization
- provider event row or payment row written for later verification/reconcile

### Stage 3: Provider confirms payment

Current confirmation models differ by lane:

- Stripe subscriptions: webhook-driven
- Paystack subscriptions: callback verify-driven
- Flutterwave subscriptions: callback verify-driven
- PAYG listing / PAYG featured: Paystack webhook-driven
- featured request activation: Paystack webhook plus reconcile backstop
- shortlet booking payments: webhook and/or verify, with reconcile support

### Stage 4: Product state is unlocked or updated

Examples:

- `profile_plans` updated for subscriptions
- `listing_credits` or `featured_credits` issued
- listing status moved to `pending`
- listing marked featured with `featured_until`
- shortlet booking advanced after successful payment

### Stage 5: Admin and ops visibility

Current ops surfaces:

- `/admin/billing` for plan state, Stripe events, and provider payment events
- `/admin/payments` for featured Paystack payment ops
- `/admin/settings/billing` for provider mode and key readiness
- reconcile jobs and workflows for selected non-subscription lanes

## Flow-By-Flow Operational Explanation

## 1. Subscriptions

### What the user is buying

Users are buying time-bound plan access.

Backend-enforced entitlements audited in repo truth:

- landlord / agent paid tiers increase listing capacity and can issue listing + featured credits based on the `plans` table
- tenant paid tier unlocks:
  - unlimited saved searches
  - instant alerts
  - 60 minutes early access

Important caveat:

- some plan-card UI copy mentions additional value such as priority contact, but the hard entitlement model audited in [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts) is the authoritative unlock definition

### Entry points

- billing page: [web/app/dashboard/billing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/dashboard/billing/page.tsx)
- plan UI: [web/components/billing/PlansGrid.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlansGrid.tsx)
- plan cards: [web/components/billing/PlanCard.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlanCard.tsx)

### When payment is triggered

When the user clicks an enabled provider checkout action for a paid tier.

### Providers and current state

- Stripe subscription checkout: `AMBER`, strongest current subscription lane
- Paystack subscription checkout: `AMBER`
- Flutterwave subscription checkout: `RED` for initial live scope

### What payment unlocks

Successful subscription processing can update:

- `profile_plans.plan_tier`
- `profile_plans.billing_source`
- `profile_plans.valid_until`
- `subscriptions` records
- subscription-issued listing credits / featured credits when the plan defines them

### Billing amounts currently defined in repo

Stripe billing UI price labels:

- Landlord Pro: `£29 / month` or `£290 / year`
- Agent Pro: `£49 / month` or `£490 / year`
- Tenant Pro: `£9 / month` or `£90 / year`

Paystack / Flutterwave provider pricing constants:

- landlord: `NGN 2,900 / month` or `NGN 29,000 / year`
- agent: `NGN 4,900 / month` or `NGN 49,000 / year`
- tenant: `NGN 900 / month` or `NGN 9,000 / year`

### Current readiness view

- recurring billing is real and implemented
- only Stripe is close to disciplined initial live scope
- non-Stripe subscriptions remain more fragile because verification is callback-driven rather than webhook-first

## 2. PAYG Listing Submission

### What the user is buying

A one-off listing submission slot when the owner has no available listing credits.

### Who pays

- landlord
- agent
- delegated/owner-supported host cases through the same owner listing payment records

### When payment is triggered

The listing owner attempts to submit a listing and:

- has no usable listing credits
- has no trial credits left to issue/consume
- PAYG is enabled

At that point the listing submit route returns `402 PAYMENT_REQUIRED` with the configured amount and currency.

### Entry points and server path

- submit route: [web/app/api/properties/[id]/submit/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/properties/[id]/submit/route.ts)
- checkout route: [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- webhook route: [web/app/api/billing/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/webhook/route.ts)

### Provider and current state

- Provider: Paystack
- Currency default: `NGN`
- Status: `AMBER`

### What payment unlocks

On successful webhook processing:

1. `listing_payments.status` becomes `paid`
2. one `listing_credits` row is inserted with source `payg`
3. the credit is immediately consumed for the listing
4. the listing moves to `pending` review with `submitted_at` set

### Current default pricing in repo

- default PAYG listing fee: `NGN 2,000`
- controlled through app settings, with `NGN` as the default configured currency lane

## 3. PAYG Featured Listing

### What the user is buying

A one-off featured placement for an already-live listing when the owner has no available featured credits.

### Who pays

- landlord
- agent

### When payment is triggered

The owner attempts to feature a live listing and:

- has no usable featured credits
- the listing is eligible to be featured

The feature route returns `402 PAYMENT_REQUIRED` with the configured featured amount and currency.

### Entry points and server path

- feature route: [web/app/api/properties/[id]/feature/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/properties/[id]/feature/route.ts)
- checkout route: [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- webhook route: [web/app/api/billing/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/webhook/route.ts)

### Provider and current state

- Provider: Paystack
- Currency default: `NGN`
- Status: `AMBER`

### What payment unlocks

On successful webhook processing:

1. `feature_purchases.status` becomes `paid`
2. one `featured_credits` row is inserted with source `payg`
3. the credit is immediately consumed for the listing
4. the property is marked featured and `featured_until` is set

### Current default pricing in repo

- default PAYG featured fee: `NGN 5,000`
- default featured duration from this lane: `7` days unless changed in app settings

## 4. Featured Request Activation Payment

### What the user is buying

Activation of an approved featured request for a listing.

This is a distinct monetisation lane from the simpler PAYG featured flow because it uses the `payments` + `featured_purchases` model and an approval-first request flow.

### Who pays

- landlord
- agent
- admin can inspect and support the flow

### When payment is triggered

After an admin-approved featured request is ready for the requester to activate.

### Entry points and server path

- initialize route: [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)
- status route: [web/app/api/payments/status/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/status/route.ts)
- webhook route: [web/app/api/webhooks/paystack/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/webhooks/paystack/route.ts)
- reconcile routes: [web/app/api/jobs/payments/reconcile/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/jobs/payments/reconcile/route.ts), [web/app/api/admin/payments/reconcile/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/admin/payments/reconcile/route.ts)
- ops page: [web/app/admin/payments/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/payments/page.tsx)

### Provider and current state

- Provider: Paystack
- Currency: configured featured currency from app settings
- Status: `AMBER`

### What payment unlocks

On successful processing:

1. a `payments` row and `featured_purchases` row are created
2. Paystack success plus activation logic marks the payment `succeeded`
3. the approved featured purchase is activated
4. the listing is featured for the purchased duration
5. a receipt can be sent

### Current pricing model in repo

- product plans are `featured_7d` and `featured_30d`
- price values come from app settings:
  - `featured_price_7d_minor`
  - `featured_price_30d_minor`
  - `featured_currency`

## 5. Shortlet Booking Payments

### What the user is buying

A shortlet booking payment for a specific stay.

### Who pays

- the booking guest, usually a tenant

### When payment is triggered

When a payable shortlet booking enters checkout and the user continues payment.

### Entry points and server path

- Stripe init: [web/app/api/shortlet/payments/stripe/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/stripe/init/route.ts)
- Paystack init: [web/app/api/shortlet/payments/paystack/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/paystack/init/route.ts)
- status route: [web/app/api/shortlet/payments/status/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/status/route.ts)
- routing helper: [web/lib/shortlet/payments.server.ts](/Users/olubusayoadewale/rentnow/web/lib/shortlet/payments.server.ts)

### Provider and current state

- Nigeria-local `NGN` lanes: Paystack preferred
- non-`NGN` lanes: Stripe preferred
- Status: `AMBER`, but this is the strongest near-live charge collection lane in the current repo

### What payment unlocks

Successful payment updates `shortlet_payments` and feeds post-payment booking state logic. In practice, this is what allows the booking to move forward beyond unpaid state.

### Important monetisation caveat

The repo clearly implements booking payment collection, but the audited surfaces in this batch do not yet provide a canonical one-page explanation of:

- host payout timing
- platform fee split
- net revenue recognition model

That means shortlet checkout is definitely a money-moving flow, but the net platform revenue model around it should still be presented carefully to stakeholders.

## 6. Admin Manual Billing Override

This is not a revenue stream.

It matters because it can unlock paid access without a customer payment and therefore must be kept separate from revenue reporting.

### What it does

- sets `billing_source = manual`
- updates `plan_tier`
- updates `valid_until`
- can set `max_listings_override`

### Entry points

- admin billing page
- admin user drawer billing actions
- route: [web/app/api/admin/billing/actions/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/admin/billing/actions/route.ts)

### Status

- `MANUAL`
- operationally useful, but not revenue

## Live Vs Planned Separation

## Live or Near-Live Monetisation Lanes

These are the monetisation paths that clearly exist in repo truth today and are either live in code or being actively hardened toward initial live scope:

- Stripe subscriptions
- Paystack subscriptions
- Paystack PAYG listing fees
- Paystack PAYG featured listing fees
- Paystack featured request activation payments
- shortlet booking payments via Stripe/Paystack routing

## Conditionally In Initial Live Scope

Based on the current hardening plan, the disciplined initial live scope is:

- Stripe subscription billing
- Stripe shortlet booking payments for non-`NGN` lanes
- Paystack shortlet booking payments for Nigeria-local `NGN` lanes
- Paystack Nigeria-local `NGN` PAYG listing fees
- Paystack Nigeria-local `NGN` featured payments

## Not Yet Live Or Not Safe To Present As Fully Live

- Flutterwave as an initial live provider lane
- broad international Paystack monetisation
- any claim that all subscription providers are equally production-hardened
- any claim that featured monetisation has one fully consolidated canonical backend model

## Stakeholder Explanation

## Here is how the platform earns revenue

Today, the platform is designed to earn revenue in four ways:

1. recurring subscriptions for tenants, landlords, and agents
2. one-off listing submission fees when a host has no credits
3. one-off featured placement fees for extra listing visibility
4. shortlet booking payments

## Here is when users are charged

- tenants, landlords, and agents are charged when they actively upgrade from the billing page
- landlords and agents are charged when they try to submit or feature listings without credits
- landlords and agents can also pay to activate approved featured requests
- guests are charged when they pay for a shortlet booking

## Here is what payment unlocks

- subscriptions unlock time-bound plan access and may issue recurring listing/featured credits
- PAYG listing payment unlocks one listing submission into moderation/review
- PAYG featured payment unlocks one featured placement window for a listing
- featured request payment unlocks approved featured activation
- shortlet booking payment unlocks the booking’s paid state progression

## Here is what is not yet active or should not be oversold

- Flutterwave should not be treated as part of initial live payments
- provider routing is still being standardized across non-shortlet lanes
- not every payment flow is equally hardened yet
- shortlet revenue recognition beyond payment collection still needs clearer canonical documentation

## Risks And Caveats

1. Payment hardening is still in progress.
   - Stripe and Paystack are both still in `AMBER` territory overall.
2. Provider routing is only fully explicit in shortlets.
   - subscriptions remain user-choice driven in UI
   - PAYG and featured flows are still Paystack-locked
3. Shortlet payment collection is clearer than shortlet payout economics.
4. Admin manual overrides can create paid access without revenue and should never be treated as earned revenue.
5. Tenant Pro UI copy should not be treated as the sole source of truth.
   - backend-enforced unlocks are the reliable definition for stakeholder communication

## Source-Of-Truth Files

Core audited files for future reference:

- [web/app/dashboard/billing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/dashboard/billing/page.tsx)
- [web/components/billing/PlansGrid.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlansGrid.tsx)
- [web/components/billing/PlanCard.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlanCard.tsx)
- [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)
- [web/lib/billing/provider-payments.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-payments.ts)
- [web/lib/billing/subscription-credits.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-credits.server.ts)
- [web/app/api/billing/stripe/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/checkout/route.ts)
- [web/app/api/billing/paystack/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/initialize/route.ts)
- [web/app/api/billing/paystack/verify/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/verify/route.ts)
- [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- [web/app/api/billing/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/webhook/route.ts)
- [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)
- [web/app/api/shortlet/payments/stripe/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/stripe/init/route.ts)
- [web/app/api/shortlet/payments/paystack/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/paystack/init/route.ts)
- [web/lib/shortlet/payments.server.ts](/Users/olubusayoadewale/rentnow/web/lib/shortlet/payments.server.ts)
- [web/app/api/admin/billing/actions/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/admin/billing/actions/route.ts)
