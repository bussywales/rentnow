# Payments Readiness Audit — 2026-03-20

This audit is based on repo truth only. I did not have access to live provider dashboards, live credentials, or production event logs in this environment. Read this as a code-informed readiness report, not proof that live provider configuration is correct.

## A) Executive summary

Current payments readiness is mixed.

- Stripe subscriptions are the most operationally complete payment lane in the repo.
- Paystack powers real non-subscription payment paths today, but the codebase contains multiple Paystack stacks with inconsistent config and webhook/reconcile assumptions.
- Shortlet payments are materially more mature than featured/payg ops, but they are still split across separate provider-specific webhook and reconcile paths.
- Provider readiness is not the same as product readiness. The repo contains payment code that can process money, but several paths are still fragile enough that taking both Stripe and Paystack fully live would be high-risk without a final ops pass.

### Current provider status

- Stripe: `AMBER`
- Paystack: `AMBER`
- Flutterwave: `RED` for live launch relevance in current scope

### Biggest risks

1. Stripe webhook architecture is split across two routes but only one mode-scoped webhook secret is configured in code.
2. Paystack is split across two config systems and multiple webhook/reconcile paths.
3. Paystack and Flutterwave subscription verification depend on return/callback verification routes rather than provider webhooks.
4. Featured payments are implemented through two different server models, which weakens admin ops clarity and reconciliation confidence.
5. Admin payments ops are focused on Paystack featured payments, not the full payment estate.

### Top go-live blockers

1. Resolve Stripe webhook secret/routing for both subscription billing and shortlet checkout events.
2. Unify Paystack live-key source of truth across checkout, webhook, and reconcile paths.
3. Decide and document the authoritative go-live model for provider subscription verification: webhook-driven or callback-only with explicit ops fallback.
4. Confirm which featured payment path is canonical and ensure admin ops/reconcile covers that path completely.

## B) Payment flow inventory

| Flow | Audience | Provider(s) | Entry points | Backend routes | Webhook / callback dependency | Billing / entitlement update path | Readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Subscription upgrade via Stripe | tenant, landlord, agent | Stripe | `/dashboard/billing` | `/api/billing/stripe/checkout`, `/api/billing/stripe/portal`, `/api/billing/stripe/webhook` | Stripe webhook required | `profile_plans` + `subscriptions` + subscription credit issuance | `AMBER` |
| Subscription upgrade via Paystack | tenant, landlord, agent | Paystack | `/dashboard/billing` | `/api/billing/paystack/initialize`, `/api/billing/paystack/verify` | callback/verify required; no webhook route found | `provider_payment_events` -> `profile_plans` + `subscriptions` + subscription credit issuance | `AMBER-RED` |
| Subscription upgrade via Flutterwave | tenant, landlord, agent | Flutterwave | `/dashboard/billing` | `/api/billing/flutterwave/initialize`, `/api/billing/flutterwave/verify` | callback/verify required; no webhook route found | `provider_payment_events` -> `profile_plans` + `subscriptions` + subscription credit issuance | `RED` |
| PAYG listing submission fee | landlord, agent, admin delegated cases | Paystack | listing submit / host listing flows | `/api/billing/checkout`, `/api/billing/webhook` | Paystack webhook expected | `listing_payments` -> listing credits -> property status moves to `pending` | `AMBER` |
| PAYG featured listing activation from listing flow | landlord, agent, admin delegated cases | Paystack | feature listing workflow | `/api/billing/checkout`, `/api/billing/webhook` | Paystack webhook expected | `feature_purchases` -> featured credit -> property featured state | `AMBER` |
| Featured request payment v1 | landlord, agent, admin | Paystack | featured request approval flow | `/api/payments/featured/initialize`, `/api/payments/status`, `/api/webhooks/paystack`, `/api/jobs/payments/reconcile`, `/api/admin/payments/reconcile` | Paystack webhook and/or reconcile | `payments` + `featured_purchases` -> activation RPC + receipt send | `AMBER` |
| Shortlet booking checkout | tenant, landlord, agent, admin test paths | Stripe, Paystack | `/payments/shortlet/checkout`, trip continue-payment links | `/api/shortlet/payments/paystack/init`, `/api/shortlet/payments/stripe/init`, `/api/shortlet/payments/paystack/verify`, `/api/shortlet/payments/status`, `/api/webhooks/paystack`, `/api/webhooks/stripe`, `/api/internal/shortlet/reconcile-payments` | provider webhook plus reconcile safety net | `shortlet_payments` -> booking transition helpers -> notifications | `AMBER-GREEN` |
| Admin manual plan override | admin | none | `/admin/billing`, admin user drawer | `/api/admin/billing/actions`, `/api/admin/billing/notes` | none | forces `profile_plans.billing_source = manual`; provider updates skip over it | `GREEN` |

## C) Provider readiness

### Stripe

#### Current integration points

- Subscription checkout: [web/app/api/billing/stripe/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/checkout/route.ts)
- Subscription portal: [web/app/api/billing/stripe/portal/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/portal/route.ts)
- Subscription webhook ingest: [web/app/api/billing/stripe/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/webhook/route.ts)
- Subscription event processor: [web/lib/billing/stripe-event-processor.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-event-processor.ts)
- Stripe plan / price mapping: [web/lib/billing/stripe-plans.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-plans.ts)
- Shortlet Stripe checkout init: [web/app/api/shortlet/payments/stripe/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/stripe/init/route.ts)
- Shortlet Stripe webhook: [web/app/api/webhooks/stripe/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/webhooks/stripe/route.ts)

#### Required secrets / config

- `STRIPE_SECRET_KEY[_TEST|_LIVE]`
- `STRIPE_WEBHOOK_SECRET[_TEST|_LIVE]`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- role/cadence price IDs:
  - landlord monthly/yearly
  - agent monthly/yearly
  - tenant monthly/yearly
- provider mode in `provider_settings.stripe_mode`

#### Webhook endpoints

- Subscription billing: `/api/billing/stripe/webhook`
- Shortlet payments: `/api/webhooks/stripe`

#### Known missing pieces / fragility

1. Both Stripe webhook routes use the same mode-scoped secret resolver in [web/lib/billing/stripe.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe.ts).
2. In normal Stripe setup, distinct webhook endpoints have distinct signing secrets.
3. The repo does not expose separate secrets for the two routes.
4. That means one of these must be true before live:
   - only one webhook endpoint is actually used, and it needs to fan out internally; or
   - the app must support separate secrets per route; or
   - the Stripe dashboard must be set up in some non-standard way that is not visible in repo.

This is the clearest pre-live blocker in the Stripe lane.

#### Test-vs-live assumptions

- Mode switching is explicit via `provider_settings.stripe_mode`.
- Admin billing/settings pages assume env keys and prices are the live source of truth.
- Live readiness banners in admin UI only prove env presence, not end-to-end webhook correctness.

#### Confidence

- Subscription billing logic: medium-high
- Live Stripe readiness: medium-low until webhook routing/secrets are made unambiguous

### Paystack

#### Current integration points

- Subscription initialize: [web/app/api/billing/paystack/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/initialize/route.ts)
- Subscription verify: [web/app/api/billing/paystack/verify/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/verify/route.ts)
- PAYG listing / featured checkout: [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- PAYG listing / featured webhook: [web/app/api/billing/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/webhook/route.ts)
- Featured request payment init: [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)
- Paystack multi-purpose webhook: [web/app/api/webhooks/paystack/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/webhooks/paystack/route.ts)
- Featured reconcile: [web/app/api/jobs/payments/reconcile/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/jobs/payments/reconcile/route.ts)
- Shortlet reconcile: [web/app/api/internal/shortlet/reconcile-payments/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/internal/shortlet/reconcile-payments/route.ts)
- Paystack config via billing provider settings: [web/lib/billing/paystack.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/paystack.ts)
- Paystack server config via env-only ops helper: [web/lib/payments/paystack.server.ts](/Users/olubusayoadewale/rentnow/web/lib/payments/paystack.server.ts)

#### Required secrets / config

Repo indicates two separate sources are in play:

- DB/env hybrid provider settings for billing stack
  - `provider_settings.paystack_*`
  - fallback env `PAYSTACK_SECRET_KEY[_TEST|_LIVE]`, `PAYSTACK_PUBLIC_KEY[_TEST|_LIVE]`
- Env-only ops stack
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_PUBLIC_KEY`
  - optional `PAYSTACK_WEBHOOK_SECRET` fallbacking to secret key

#### Webhook / callback endpoints

- `/api/billing/webhook`
- `/api/webhooks/paystack`
- callback verify path for subscriptions: `/api/billing/paystack/verify`
- callback verify path for shortlets: `/api/shortlet/payments/paystack/verify`

#### Known missing pieces / fragility

1. Paystack config is split across two systems.
   - Billing routes use [web/lib/billing/paystack.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/paystack.ts)
   - Reconcile + webhook ops use [web/lib/payments/paystack.server.ts](/Users/olubusayoadewale/rentnow/web/lib/payments/paystack.server.ts)
2. Those systems do not have the same source of truth.
   - A DB-stored live key can make checkout work while env-only reconcile/webhook code still thinks Paystack is unconfigured.
3. There are multiple Paystack webhook routes in code with overlapping charge-success semantics.
4. Subscription verification is callback-driven rather than webhook-driven.
5. Featured payments use two server models:
   - `payments` + `featured_purchases`
   - `feature_purchases` without `payments`

That combination is functional, but not clean enough yet to call confidently live-ready.

#### Test-vs-live assumptions

- Billing UI can report Paystack mode from `provider_settings` and allow test/live toggles.
- Some ops routes still assume env-secret presence rather than provider-settings presence.
- Reconcile coverage exists for Paystack featured payments and shortlet payments, but not for provider subscription events.

#### Confidence

- PAYG listing / feature charge capability: medium
- Shortlet Paystack capability: medium-high
- Subscription reliability under live conditions: medium-low

## D) Billing and entitlement coupling

### What is robust

- Effective entitlement calculation is explicit and expiry-aware through [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts) and [web/lib/plan-enforcement.ts](/Users/olubusayoadewale/rentnow/web/lib/plan-enforcement.ts).
- Manual admin overrides are respected and provider updates skip over them.
  - Stripe path: [web/lib/billing/stripe-plan-update.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-plan-update.ts)
  - Paystack / Flutterwave path: [web/lib/billing/provider-payments.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-payments.ts)
- Subscription payment success can issue listing/featured credits via [web/lib/billing/subscription-credits.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-credits.server.ts).
- Saved-search limits and listing limits depend on effective plan state, not raw plan labels.

### What is fragile

- Subscription entitlements are updated through different transport models:
  - Stripe via webhook event ingestion
  - Paystack via return-page verify
  - Flutterwave via return-page verify
- Provider subscription events are stored in `provider_payment_events`, but there is no generic provider reconcile job comparable to Stripe webhook replay or Paystack featured reconcile.
- Admin billing ops provide good visibility for Stripe webhook events and provider event rows, but they do not constitute proof that a live provider payment always reaches `profile_plans` automatically.
- Featured monetisation is split between older and newer payment models, weakening one-source-of-truth reasoning.

## E) Reconciliation and ops

### What exists

- Payments reconcile GitHub Action: [/.github/workflows/payments-reconcile.yml](/Users/olubusayoadewale/rentnow/.github/workflows/payments-reconcile.yml)
- Featured Paystack batch reconcile job: [web/app/api/jobs/payments/reconcile/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/jobs/payments/reconcile/route.ts)
- Featured Paystack reconcile engine: [web/lib/payments/reconcile.server.ts](/Users/olubusayoadewale/rentnow/web/lib/payments/reconcile.server.ts)
- Shortlet reconcile job: [web/app/api/internal/shortlet/reconcile-payments/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/internal/shortlet/reconcile-payments/route.ts)
- Admin manual reconcile: [web/app/api/admin/payments/reconcile/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/admin/payments/reconcile/route.ts)
- Admin billing ops: [web/app/admin/billing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/billing/page.tsx)
- Admin payments ops: [web/app/admin/payments/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/payments/page.tsx)
- Admin provider settings: [web/app/admin/settings/billing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/settings/billing/page.tsx)

### What reconcile covers

- Paystack featured/payment rows in the `payments` table
- receipt dedupe/send for that same featured path
- shortlet stale or mismatched payment states

### What reconcile does not clearly cover

- Stripe subscription event recovery beyond webhook replay/admin inspection
- Paystack subscription `provider_payment_events` that never get verified on return
- Flutterwave provider events that never get verified on return
- PAYG listing submission / feature payments written through `/api/billing/checkout` and `listing_payments` / `feature_purchases`

### What operators need before go-live

- provider secrets present in the exact config source each route actually uses
- webhook endpoints configured and tested with real signed payloads
- admin checks that validate end-to-end plan update, not only checkout redirect
- reconcile jobs enabled and observed cleanly for at least one full day in test mode before live flip

## F) Go-live checklist

### Secrets and config

- Stripe
  - set `STRIPE_SECRET_KEY_LIVE`
  - set the correct live publishable key
  - set all live price IDs for landlord, agent, tenant monthly/yearly
  - confirm `provider_settings.stripe_mode = live`
- Paystack
  - set live secret/public keys in the authoritative source used by every relevant route
  - if DB keys are used, confirm env-only ops paths are not left behind
  - confirm `provider_settings.paystack_mode = live`
- Flutterwave
  - only if intended for live use; otherwise keep out of launch scope

### Webhooks and callbacks

- Stripe
  - prove how subscription events and shortlet events are both delivered and verified
  - if two webhook routes remain, support two secrets or one explicit ingress route
- Paystack
  - decide whether `/api/billing/webhook`, `/api/webhooks/paystack`, or both are required in live
  - document exact provider dashboard webhook URL configuration
- Callback URLs
  - Stripe billing success/cancel URLs
  - Paystack billing callback to `/dashboard/billing?provider=paystack`
  - Flutterwave billing callback to `/dashboard/billing?provider=flutterwave`
  - shortlet return URLs for Stripe and Paystack

### Smoke tests

- Stripe subscription checkout from each supported role
- Stripe webhook updates `profile_plans` and `subscriptions`
- Stripe billing portal opens for active subscriber
- Paystack subscription initialize + verify updates `profile_plans`
- PAYG listing submission charge moves listing to `pending`
- Featured payment activates listing and sends one receipt only
- Shortlet Stripe payment moves booking out of `pending_payment`
- Shortlet Paystack payment moves booking out of `pending_payment`
- Admin billing and payments ops pages reflect resulting events

### Admin checks

- `/admin/billing`
  - webhook/provider events recorded
  - support snapshot loads
  - live readiness warnings clear
- `/admin/payments`
  - featured payment ops rows populate
  - manual reconcile works on a known reference
- workflow
  - `Payments Reconcile` run succeeds with no missing-secret or endpoint errors

### Rollback / kill switches

- revert provider modes back to `test`
- disable shortlet provider flags:
  - `shortlet_payments_stripe_enabled`
  - `shortlet_payments_paystack_enabled`
- use manual plan override if entitlement rollback is needed for a user

## G) Red / Amber / Green assessment

### By provider

- Stripe subscriptions: `AMBER`
  - good backend depth, but webhook secret/routing ambiguity is a pre-live blocker
- Stripe shortlet payments: `AMBER`
  - flow exists and is tested, but depends on the same webhook-secret ambiguity
- Paystack PAYG listing payments: `AMBER`
  - real wiring exists, but reconcile/ops and config sources are not fully unified
- Paystack featured request payments: `AMBER`
  - webhook + reconcile exist, but this sits beside another featured payment model
- Paystack shortlet payments: `AMBER-GREEN`
  - strongest Paystack lane after shortlets hardening, but still depends on split webhook/config story
- Paystack subscriptions: `AMBER-RED`
  - checkout and verify exist, but no webhook/reconcile backstop found for provider events
- Flutterwave subscriptions: `RED`
  - initialize/verify exists, but operational backstop is weaker than Stripe and Paystack

### By major flow

- Subscription billing overall: `AMBER`
- PAYG listing submission: `AMBER`
- Featured activation monetisation overall: `AMBER`
- Shortlet booking payments overall: `AMBER-GREEN`
- Admin payment ops visibility overall: `AMBER`

## H) Recommended next actions

### 1. Must fix before live

1. Resolve Stripe webhook architecture.
   - Either merge Stripe event ingress to one route or support separate webhook secrets per route.
2. Unify Paystack secret/config resolution.
   - The billing stack and ops/reconcile stack must not read different sources.
3. Decide the canonical featured payment model.
   - Either the `payments` model or the `feature_purchases/listing_payments` model should be the ops source of truth.
4. Define the live truth for provider subscription verification.
   - If Paystack/Flutterwave remain callback-only, document the operational acceptance of that risk explicitly.

### 2. Should fix before live

1. Add a provider-go-live runbook specific to Stripe and Paystack dashboard configuration.
2. Add a single admin/internal report that shows subscription verify rows stuck in `initialized` or `pending`.
3. Add an explicit live smoke script covering one Stripe subscription, one Paystack subscription, one PAYG listing fee, one featured payment, and both shortlet providers.
4. Clarify admin ops labeling so `/admin/payments` is not mistaken for the full payment estate.

### 3. Can wait until after launch

1. Flutterwave production hardening if it is not part of the immediate launch plan.
2. Unifying all payment event telemetry into one ops dashboard.
3. Deeper provider-agnostic reconciliation for all non-Stripe subscription events.

## Bottom line

The repo contains enough payment functionality to justify a serious pre-live pass, not enough to casually flip both providers live without final hardening.

If forced to summarise readiness in one sentence:

- Stripe is close, but webhook architecture is the main blocker.
- Paystack is broader in coverage, but more fragmented in implementation.
- Shortlet payments are the healthiest live candidate.
- Subscription go-live needs one more round of operational consolidation before it should be called safe.
