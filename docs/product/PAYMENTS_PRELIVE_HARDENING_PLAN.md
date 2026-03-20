# Payments Pre-Live Hardening Plan

## A) Executive summary

The initial live payment scope should be deliberately smaller than the total code footprint.

Recommended initial live scope:

- `Stripe`
  - subscription billing
  - non-NGN shortlet bookings
- `Paystack`
  - Nigeria-local `NGN` shortlet bookings
  - Nigeria-local `NGN` PAYG listing submission
  - Nigeria-local `NGN` featured payments

Explicitly out for initial live scope:

- `Flutterwave`
- non-NGN Paystack subscription or monetisation lanes
- any payment lane that depends on ambiguous provider routing

The highest-priority hardening sequence is:

1. Stripe webhook route and secret hardening
2. Paystack config source-of-truth unification
3. subscription success backstop hardening for non-Stripe providers
4. featured payments canonical model decision
5. final live smoke and ops checklist

## B) Initial live scope recommendation

### In

- Stripe subscription checkout and webhook processing
- Stripe shortlet payments for non-NGN stays
- Paystack shortlet payments for NGN / Nigeria stays
- Paystack Nigeria-local NGN PAYG listing fees
- Paystack Nigeria-local NGN featured payments

### Conditionally in only after specific fixes

- Stripe subscriptions:
  - only after route-specific webhook secret ambiguity is removed
- Paystack NGN lanes:
  - only after config source-of-truth is unified or clearly proven consistent

### Out

- Flutterwave
- non-NGN PAYG listing and featured payments
- broad international Paystack lanes
- any provider-choice UI that bypasses canonical routing policy

## C) Ranked hardening phases

### 1. Stripe webhook hardening

Scope:

- separate billing and shortlet webhook secret resolution
- keep generic fallback for backward compatibility
- expose route-specific readiness in ops/debug surfaces

Why first:

- this is the clearest pre-live ambiguity
- Stripe is the strongest candidate for initial recurring billing
- the fix is narrowly scoped and low-risk

### 2. Paystack config unification

Scope:

- remove divergence between:
  - [web/lib/billing/paystack.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/paystack.ts)
  - [web/lib/payments/paystack.server.ts](/Users/olubusayoadewale/rentnow/web/lib/payments/paystack.server.ts)

Why:

- avoids a live state where checkout works but webhook/reconcile thinks Paystack is unconfigured

### 3. Subscription success backstop hardening

Scope:

- add an explicit ops-safe backstop for Paystack subscription events that never return through callback verification

Why:

- callback-only subscription success is fragile

### 4. Featured payments canonical model decision

Scope:

- choose one canonical model for featured monetisation and align ops visibility around it

Why:

- current split weakens reconciliation and support confidence

### 5. Final go-live smoke checklist

Scope:

- one explicit smoke path per in-scope live payment lane

Why:

- amber does not become green through docs alone

## D) Risk-based justification

### Stripe webhook ambiguity

Risk prevented:

- misconfigured live webhook endpoints
- one Stripe route silently verifying with the wrong signing secret
- false confidence from generic env presence

### Paystack config split

Risk prevented:

- live checkout success with broken webhook or reconcile paths
- ops diagnosing the wrong key source

### Callback-only subscription fragility

Risk prevented:

- paid subscription that never updates entitlements because the user never returns through the verify callback

### Featured model fragmentation

Risk prevented:

- partial admin visibility
- harder reconciliation
- weaker support operations

## E) What not to do

- Do not include Flutterwave in the initial live scope.
- Do not treat all current payment code as launch-ready.
- Do not attempt a full provider-agnostic payments rewrite in one batch.
- Do not claim amber flows are green without the named fixes.

## F) Phase implemented in this batch

Implemented now:

- Phase 1: Stripe webhook hardening

Changes:

- billing and shortlet Stripe webhook routes now support separate route-scoped signing secrets
- generic Stripe webhook secrets still work as backward-compatible fallback
- admin/debug surfaces now expose route-specific Stripe webhook readiness

This phase was chosen because it removes the most dangerous live ambiguity with the smallest safe code change.
