---
title: Market-aware subscription pricing added to billing
date: 2026-03-30
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - billing
  - subscriptions
  - markets
summary: Replaced hardcoded GBP subscription pricing in billing with a market-aware pricing resolver that keeps display currency and checkout price selection aligned across supported markets.
---

# 2026-03-30 Market-aware subscription pricing

- Replaced hardcoded GBP subscription labels in the billing UI with market-aware pricing resolved from the active market.
- Billing now resolves subscription checkout by role, cadence, and market currency, then falls back deliberately only when a safe configured alternative exists.
- Stripe subscriptions support currency-suffixed price env keys such as `STRIPE_PRICE_TENANT_MONTHLY_NGN_LIVE` while keeping legacy role/cadence keys as fallback.
- Billing UI and checkout now share the same pricing resolver, so users are not shown one currency and charged another.
- If the active market changes while the billing page is open, checkout is paused until pricing is refreshed.
- `/api/debug/env` now exposes market-aware Stripe subscription price readiness for GBP, NGN, and CAD.

Rollback:

- `git revert <sha>`
