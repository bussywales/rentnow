---
title: Subscription price book groundwork and admin matrix added
date: 2026-03-30
audiences:
  - ADMIN
areas:
  - billing
  - subscriptions
  - pricing
summary: Added the first canonical subscription_price_book table, seeded official UK pricing truth plus current NG values, and exposed a read-only admin price matrix that compares canonical rows against current runtime checkout behavior.
---

# 2026-03-30 Subscription price book groundwork and admin matrix

## What changed

- Added `subscription_price_book` as the first canonical subscription pricing table.
- Seeded official UK subscription pricing truth and current NG runtime values.
- Added `/admin/settings/billing/prices` as a read-only admin price matrix.
- The matrix compares canonical rows against current runtime checkout pricing and flags market gaps, fallback use, missing provider refs, and checkout mismatches.

## Why this batch stayed read-only

- Corrected UK business truth needed to be established without mutating active Stripe recurring prices in place.
- Rows that need new Stripe price references are now explicit in the canonical table instead of being hidden in env-only logic.

## Operator implication

- UK business pricing is now formally represented in PropatyHub.
- Checkout is still driven by the existing runtime resolver until provider refs are linked safely.
- Canada and the United States continue to surface as market gaps with runtime GBP fallback.

## Rollback

- `git revert <sha>`
