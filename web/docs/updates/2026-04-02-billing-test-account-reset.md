---
title: "Billing test-account reset for reusable subscription smoke runs"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-04-02"
---

## What changed
- Added a strict billing test-account guard based on internal `.test` domains and optional `BILLING_TEST_ACCOUNT_EMAILS`.
- Added a new admin billing action: `Reset billing test account`.
- Reset is blocked when an active provider subscription still exists.
- Reset clears current `profile_plans` state to a free expired-manual baseline so the next Stripe smoke can reuse the account without deleting historical subscriptions or webhook events.
- Every reset attempt appends a billing note for auditability.

## Operator effect
- Real customer accounts do not get the reset action.
- Designated test accounts show whether they are:
  - reusable now
  - resettable
  - blocked by an active subscription
  - not eligible

## Preserved by design
- `subscriptions` history
- `stripe_webhook_events` history
- Stripe dashboard facts
- revenue/audit history
