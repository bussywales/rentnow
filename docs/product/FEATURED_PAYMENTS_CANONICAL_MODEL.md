# Featured Payments Canonical Model

Date: 2026-03-20
Owner: Product + Engineering
Status: Decision recorded for pre-live hardening Phase 4

## Executive summary

Featured monetisation is currently split across two backend models:

1. `payments` + `featured_purchases`
2. `feature_purchases`

That split is risky because it makes operator trust ambiguous. One admin surface, one reconcile system, and one webhook audit path already center on the first model, while a separate PAYG listing-feature flow still writes to the second model.

For the initial live scope, the canonical featured-payment model is:

- `payments` + `featured_purchases`
- with Paystack as the provider
- for approved featured-request activations

This is the model admins should trust first when checking whether a featured payment succeeded, whether activation happened, and whether reconciliation/receipt backstops are working.

`feature_purchases` remains an active but secondary lane for PAYG featured listing charges from the listing checkout flow. It is not being removed in this phase, but it is explicitly bounded as legacy/secondary until a later consolidation phase.

## Why the split is risky

The current split creates uncertainty around:

- which rows operators should trust as the featured payment ledger
- which payment lane `/admin/payments` actually represents
- which model webhook and reconcile tooling is designed around
- which model should be used for launch smoke tests and operational triage

Without an explicit decision, the product can appear to have "featured payments" fully covered even though only one lane has strong admin/reconcile visibility.

## Current-state map

### Lane A: Approved featured-request activation

Trigger:
- host/agent pays after an admin-approved featured request exists

Routes:
- `POST /api/payments/featured/initialize`
- `POST /api/webhooks/paystack`
- `GET /api/payments/status`
- `POST /api/jobs/payments/reconcile`
- `POST /api/admin/payments/reconcile`

Records written:
- `payments`
- `featured_purchases`
- `payment_webhook_events`

Entitlement effect:
- `payments.status` becomes `succeeded`
- `activate_featured_purchase(payment_id)` activates the purchase
- listing becomes featured and `featured_until` is set

Admin visibility:
- `/admin/payments`
- reconcile panels
- webhook events table
- receipt and stuck-payment ops snapshot

Provider:
- Paystack

Assessment:
- this is the stronger, more operable featured monetisation lane

### Lane B: PAYG featured listing checkout

Trigger:
- host/agent tries to feature a live listing from the listing flow without available featured credits

Routes:
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

Records written:
- `feature_purchases`
- `featured_credits`
- `featured_credit_consumptions`

Entitlement effect:
- one PAYG featured credit is inserted
- that credit is immediately consumed for the listing
- listing becomes featured and `featured_until` is set

Admin visibility:
- previously weak and implicit
- not the primary subject of `/admin/payments`

Provider:
- Paystack

Assessment:
- active monetisation lane, but weaker operator surface and not the canonical launch ledger

## Canonical model decision

For the initial live scope, the canonical featured-payment model is:

- `payments` + `featured_purchases`

This model is canonical because it already has:

- explicit payment rows
- explicit purchase rows
- dedicated webhook audit records
- dedicated reconcile endpoints/jobs
- dedicated admin operations surface
- clear success-to-activation mapping via `activate_featured_purchase`

After this decision:

- `payments` + `featured_purchases` is the source of truth for launch-critical featured payment operations
- `feature_purchases` is a secondary legacy PAYG lane that must remain visible but must not be mistaken for the canonical featured activation ledger

## Operator impact

Admins should trust these surfaces first for canonical featured payment operations:

- `/admin/payments`
- `POST /api/admin/payments/reconcile`
- `POST /api/jobs/payments/reconcile`
- `payment_webhook_events`

When troubleshooting approved featured-request activation payments, operators should answer questions in this order:

1. Did a `payments` row exist for the Paystack reference?
2. Did the related `featured_purchases` row move from `pending` to `activated`?
3. Did Paystack webhook/reconcile mark the payment `succeeded`?
4. Did the listing receive `featured_until`?
5. Did receipt sending complete?

When troubleshooting PAYG listing-feature charges, operators should check the secondary lane:

- `feature_purchases`
- `featured_credits`
- `featured_credit_consumptions`
- listing `is_featured` / `featured_until`

## What changed in this phase

This phase does not rewrite both lanes into one model.

It does:

- make the canonical model explicit in durable docs
- make `/admin/payments` clearly scoped to the canonical lane
- surface the legacy PAYG featured lane separately so operators can still inspect it without confusing it for canonical truth

## Remaining risks after this phase

The following still remain for later cleanup:

1. The PAYG featured listing lane still writes to a different model.
2. There is still no full backend consolidation of all featured monetisation under one payments table.
3. Non-NGN or non-Paystack featured monetisation remains out of initial live scope.
4. Further reconciliation/reporting unification is still desirable if PAYG featured remains a long-term revenue lane.

## What must change later

1. Decide whether PAYG featured listing charges should be migrated onto the canonical `payments` model.
2. If yes, build a deliberate migration and backfill plan rather than a silent rewrite.
3. If no, keep the dual-lane design explicit in admin ops and revenue reporting permanently.

## Launch decision

For launch readiness, treat featured monetisation as:

- canonical lane: approved featured-request activation via `payments` + `featured_purchases`
- secondary bounded lane: PAYG featured listing checkout via `feature_purchases`

Do not describe featured monetisation as having one fully unified backend model yet.
