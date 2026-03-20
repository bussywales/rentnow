---
title: Subscription success backstop hardening
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - subscriptions
---

## What was found

Paystack subscription activation was still too dependent on the browser return and verify flow.
If a user completed payment but never came back through the billing page callback path, the subscription event could remain initialized and the user could stay on stale entitlements.

## What was hardened

- added a shared Paystack subscription finalizer in `web/lib/billing/paystack-subscriptions.server.ts`
- routed both of these paths through the same idempotent finalization logic:
  - `web/app/api/billing/paystack/verify/route.ts`
  - `web/app/api/billing/webhook/route.ts`
- Paystack billing webhooks can now act as a real backstop for successful subscription charges
- manual override protection remains in place, so manual billing access is not overwritten by provider events

## What still remains

- featured payments still need canonical model consolidation
- broader provider-routing cleanup still remains
- Flutterwave remains out of the initial live payment scope

## Rollback

- `git revert <sha>`
