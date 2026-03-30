---
title: Subscription pricing mapping audited and admin price book designed
date: 2026-03-30
audiences:
  - ADMIN
areas:
  - billing
  - subscriptions
  - pricing
summary: Audited current subscription pricing across GB, NG, CA, and US; confirmed the landlord and agent roles are not swapped in code; and documented the DB-backed admin-owned price book model needed to make PropatyHub the canonical pricing source.
---

# 2026-03-30 Subscription pricing mapping audit and admin price book design

## What the audit confirmed

- Billing display and checkout now share one quote resolver.
- The suspected UK landlord versus agent swap is not a resolver bug.
- Current UK runtime prices come from the configured Stripe price IDs, and those differ from older revenue-model planning docs.
- Nigeria subscription pricing is still hardcoded in app code for local providers and is not yet admin-owned pricing truth.
- Canada and US still fall back to GBP because no market-specific subscription price coverage exists yet.

## Design outcome

- PropatyHub should own subscription pricing truth in a DB-backed price book.
- Stripe, Paystack, and Flutterwave should consume linked provider references from that internal price book.
- Stripe recurring price changes should use new Stripe price objects, not in-place mutation.

## Immediate operator implication

- Do not treat the existing env-only subscription pricing model as the long-term control panel.
- Resolve the UK landlord business-price mismatch before broader live expansion.
- Do not market CA or US subscription pricing as fully launched until market-specific rows exist.

## Rollback

- `git revert <sha>`
