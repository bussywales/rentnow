# Payments Guardian v1

## Purpose

Payments Guardian v1 is the third live PropatyHub Codex automation.

Its job is to review payment-lane changes, payment docs, cutover assumptions, and payment-ops evidence so the team gets one disciplined daily payment-readiness brief instead of relying on scattered memory and partial UI signals.

V1 is intentionally review-queue based.

It does not merge code, change routing, change secrets, or alter payment behavior autonomously.

## Why this agent is the third rollout

This agent comes after Docs & Help Drift Agent and CI & Release Health Agent because it is more sensitive.

It operates close to:

- live payment configuration
- provider routing
- webhook integrity
- reconcile/cutover safety
- payment readiness claims

That means the value is high, but the review boundary must be strict.

This document should be used with:

- [PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [REVENUE_MODEL_AND_PAYMENT_STAGES.md](/Users/olubusayoadewale/rentnow/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md)
- [FEATURED_PAYMENTS_CANONICAL_MODEL.md](/Users/olubusayoadewale/rentnow/docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md)
- [PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md)
- [BILLING.md](/Users/olubusayoadewale/rentnow/web/docs/BILLING.md)
- [payments-v1-paystack.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-paystack.md)
- [payments-v1-ops-vercel-cron.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-ops-vercel-cron.md)

## Operating model

### Schedule

Default cadence:

- every weekday at 08:00 Europe/London time

Recommended extra runs:

- on the morning of any planned payment cutover
- after merges touching payment-sensitive paths
- after a payment reconcile workflow failure
- after a payment hardening or billing-ops batch lands

## Scope in v1

In scope for daily payment review:

- payment-lane code and config changes
- payment docs and cutover-doc drift
- webhook/config ambiguity
- reconcile and cutover blockers
- lane-by-lane launch-confidence drift

Primary code and config surfaces in scope:

- `web/app/api/billing/**`
- `web/app/api/payments/**`
- `web/app/api/webhooks/**`
- `web/app/api/shortlet/payments/**`
- `web/lib/billing/**`
- `web/lib/payments/**`
- `web/lib/shortlet/**`
- [/.github/workflows/payments-reconcile.yml](/Users/olubusayoadewale/rentnow/.github/workflows/payments-reconcile.yml)

Primary doc and ops surfaces in scope:

- [PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [REVENUE_MODEL_AND_PAYMENT_STAGES.md](/Users/olubusayoadewale/rentnow/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md)
- [FEATURED_PAYMENTS_CANONICAL_MODEL.md](/Users/olubusayoadewale/rentnow/docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md)
- [BILLING.md](/Users/olubusayoadewale/rentnow/web/docs/BILLING.md)
- [payments-v1-paystack.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-paystack.md)
- [payments-v1-ops-vercel-cron.md](/Users/olubusayoadewale/rentnow/web/docs/payments-v1-ops-vercel-cron.md)

Out of scope for autonomous action:

- provider routing changes
- webhook endpoint or secret changes
- billing entitlement changes
- provider mode changes
- schema changes
- production config or dashboard changes
- launch-readiness claims that are not supported by evidence

## Lane model

Every daily report must review these lanes explicitly:

1. Stripe subscriptions
2. Paystack subscriptions
3. Stripe shortlet non-NGN lanes
4. Paystack shortlet NGN lanes
5. Paystack NGN PAYG listing fees
6. Canonical featured activation payments
7. Flutterwave as explicit out-of-scope watch context

The lane snapshot should show:

- current confidence drift
- whether anything changed in the review window
- whether a lane is blocked, watch-only, or stable

## Inputs

Each run should read:

- recent merged changes since the previous successful run
- recent payment-related update notes
- payment docs and cutover docs
- payment-related workflow evidence where available
- recent billing, webhook, reconcile, or provider-settings changes

Prefer live evidence first:

- workflow run results
- reconcile workflow state
- recent operator docs/update notes that record what changed

If live workflow metadata is unavailable, the agent must say so clearly and downgrade confidence to repo-history inference.

## What should trigger the agent

V1 should treat these change families as payment drift candidates:

- billing checkout or verify route changes
- webhook route changes
- provider settings or config helper changes
- plan or entitlement coupling changes
- reconcile or cron workflow changes
- shortlet payment routing changes
- payment docs, cutover docs, or revenue doc changes
- featured payment model or admin payment-ops changes

High-sensitivity change families:

- Stripe webhook secret resolution
- Paystack config resolution
- subscription success/finalization paths
- canonical featured-payment lane
- payment reconcile workflow and operator runbooks

## Classification model

Every important finding should be classified as one primary type:

- `code/docs drift`
  - code reality and payment docs/cutover assumptions are diverging
- `webhook/config ambiguity`
  - key routing, secret, mode, or provider config assumptions are unclear or split
- `reconcile/cutover risk`
  - fallback/recovery/cutover assumptions may not hold safely
- `launch-readiness watch item`
  - non-blocking but important lane-confidence signal
- `release-gate blocker`
  - the issue materially blocks safe launch or safe staged enablement

Use one primary class plus an additional note only if needed.

### Severity model

Use this severity model in every report:

- `S1 Critical`
  - critical launch or payment-safety blocker
- `S2 High`
  - important payment-lane risk or readiness regression
- `S3 Medium`
  - non-blocking issue worth review
- `S4 Low`
  - minor cleanup or clarity issue

## Time-window rule

Default review window:

- only payment changes, evidence, and workflow results since the previous successful run

Use a broader backfill only when explicitly requested.

## Evidence priority rule

Prefer evidence in this order:

1. live run or workflow evidence
2. operator docs or hardening docs
3. payment code/config changes
4. update notes that explain shipped intent

If live workflow metadata is unavailable:

- state that the report is a repo-history inference
- lower confidence accordingly

## Evidence rule

Use the 2 to 4 most relevant references per finding.

Preferred references:

- specific route/helper/workflow file
- specific payment doc or cutover doc
- specific update note for the payment change

Do not overload the report with low-signal references.

## Outputs

Each run should produce one daily review artifact using [PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md).

Required outputs in v1:

- daily Payments Guardian report
- lane-by-lane snapshot
- payment drift findings
- recommended next actions
- optional owner-area or patch-target suggestions

Permitted additional outputs in v1:

- docs patch target
- operator config clarification target
- stabilization batch suggestion

V1 should not create autonomous PRs.

## Review rules

Every run must classify its output as one of:

1. `report only`
2. `review required`
3. `blocked pending approval`

### Auto-allowed in v1

These may be suggested safely:

- payment readiness reports
- lane snapshot updates
- docs clarification targets
- operator runbook clarification targets
- owner-area suggestions

### Review-required in v1

These must stop in the review queue:

- any provider routing change
- any webhook or secret change
- any provider mode or dashboard change
- any billing-status or entitlement interpretation change
- any schema or payment-behavior change
- any stronger launch-readiness claim than the evidence supports

### Never autonomous

The agent must never:

- merge directly to `main`
- change payment routing
- change webhook endpoints or secrets
- change provider settings
- change billing status or entitlements
- change schema or app code
- change launch or cutover policy

## Allowed-touch boundary

The agent may touch only:

- `docs/product/*payments*`
- `web/docs/BILLING.md`
- `web/docs/payments-*`
- `web/docs/updates/**`

It must not patch payment code or workflow logic in v1.

## Daily report format

Use one report per run with this structure:

1. `Summary`
2. `Payment-lane snapshot`
3. `In-scope changes observed`
4. `Findings grouped by lane or cross-lane risk`
5. `Classification`
6. `Likely affected lane`
7. `Recommended next action`
8. `Recently shipped payment changes worth operator awareness`
9. `Optional patch or stabilisation targets`

The exact template lives in [PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md).

## Recommended next-action labels

Use only these labels:

- `monitor only`
- `verify release gate`
- `stabilization batch`
- `docs patch batch`
- `operator config fix`
- `escalate for product review`

## Recommended operator workflow

Daily operator loop:

1. Review the lane snapshot first.
2. Triage `S1` and `S2` findings before lower-severity items.
3. Confirm whether the evidence is live-run evidence or repo-history inference.
4. Separate findings into:
   - docs clarity issue
   - config ambiguity
   - reconcile/cutover risk
   - blocked lane
5. If the issue is low-risk and documentation-only, open a narrow docs patch batch.
6. If the issue affects real payment behavior or cutover meaning, open a review batch instead of guessing.

## How to turn a report into a safe follow-up batch

Use this decision rule:

- open a `docs patch batch` when:
  - code truth and payment-doc drift are clear
- open an `operator config fix` when:
  - the issue is operationally real but does not require code changes
- open a `stabilization batch` when:
  - a narrow payment-related ambiguity or workflow issue can be fixed safely
- `escalate for product review` when:
  - routing, lane ownership, entitlement meaning, or launch policy needs a human decision

Safe follow-up batch output should contain:

- lane affected
- severity and classification
- evidence references
- exact docs/config/workflow target
- rollback instruction

## v1 success criteria

Payments Guardian v1 is working if it:

- makes payment-lane drift visible early
- keeps cutover docs and code assumptions aligned
- highlights launch-readiness risk without overclaiming
- gives future chats and operators one disciplined payment review format
- never crosses its review boundary

## What v1 does not try to solve

V1 does not:

- act as a live payments controller
- auto-fix payment code
- decide cutover by itself
- replace human ops review for launch readiness

That restraint is deliberate.

