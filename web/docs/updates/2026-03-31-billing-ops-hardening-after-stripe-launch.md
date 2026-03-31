---
title: "Billing ops hardening after live Stripe tenant monthly launch"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-03-31"
---

# Billing Ops Hardening After Live Stripe Tenant Monthly Launch

## What changed

- Hardened `/admin/billing` so the loaded-account view shows billing source of truth more clearly:
  - full profile UUID
  - role
  - current/effective plan
  - billing source
  - manual override state
  - Stripe field presence
  - provider-truth alignment
- Added an operator-readable conflict panel for:
  - manual override masking stored Stripe truth
  - profile plan mismatch versus subscriptions truth
  - ignored webhook outcomes
  - missing profile attachment
  - identity mismatch across related billing events
- Expanded loaded-account Stripe webhook visibility to include:
  - replay count
  - last replay outcome
  - replay eligibility
  - linked price id visibility
- Hardened support actions:
  - clearer `Return to Stripe billing` guidance
  - `Refresh billing snapshot`
  - reason-gated `Replay Stripe event`
- Added a billing ops timeline that combines:
  - plan row updates
  - provider subscription truth
  - webhook outcomes
  - replay attempts
  - billing notes
- Replay actions now require a reason and append an audit note to `profile_billing_notes`.

## Why

The live Stripe launch proved the billing engine works, but support/admin operations were still too opaque:

- manual overrides could hide valid provider truth
- ignored webhook events were not easy to diagnose from `/admin/billing`
- replay state was not visible enough
- operators had to infer too much from masked ids and partial plan state

This batch hardens billing operations without changing product lanes or checkout flows.

## Who it affects

- Tenant: no billing product behavior changed, but support can now diagnose provider/state issues faster when an account needs intervention.
- Host/Agent: no product-lane change in this batch.
- Admin: `/admin/billing` now exposes clearer source-of-truth diagnostics, replayability, and recovery context.

## Where to find it

- `/admin/billing`

## Scope kept out

- no new monetization lanes
- no public pricing work
- no Paystack/Flutterwave subscription expansion
- no checkout redesign

## Rollback

```bash
git revert <sha>
```
