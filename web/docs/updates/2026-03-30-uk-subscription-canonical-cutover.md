---
title: UK subscription canonical cutover and Stripe linkage guardrails
date: 2026-03-30
audiences:
  - ADMIN
areas:
  - billing
  - subscriptions
  - pricing
  - stripe
summary: Cut UK subscription runtime pricing over to canonical subscription_price_book truth, allowed only safe matching legacy Stripe ref bridging for aligned rows, and blocked stale UK Stripe checkout for drifting rows until corrected recurring prices are created and linked.
---

# 2026-03-30: UK subscription canonical cutover

## What changed

- UK subscription runtime resolution now prefers canonical `subscription_price_book` rows over legacy env pricing.
- Billing UI and Stripe checkout both read the same canonical UK truth path.
- Canonical UK rows can no longer silently fall back to stale Stripe recurring prices when the linked or legacy price conflicts with canonical business pricing.
- The admin subscription price matrix now shows whether runtime pricing is canonical-backed or still relying on a temporary legacy provider-ref bridge.

## Safe transitional behaviour

- Aligned UK rows can still run through a temporary legacy Stripe ref bridge when the legacy Stripe price exactly matches canonical amount and currency.
- Conflicting UK rows now fail safely instead of charging stale legacy Stripe prices.
- This keeps existing live flows safe while forcing the remaining provider-ref work into an explicit operator step.

## Manual Stripe work still required

Create and link these corrected GBP recurring Stripe prices:

- Tenant yearly: GBP 89.99 recurring yearly
- Landlord yearly: GBP 189.99 recurring yearly
- Agent monthly: GBP 39.99 recurring monthly
- Agent yearly: GBP 389.99 recurring yearly

The currently aligned rows remain:

- Tenant monthly: GBP 9.99 recurring monthly
- Landlord monthly: GBP 19.99 recurring monthly

## Rollback

- `git revert <sha>`
