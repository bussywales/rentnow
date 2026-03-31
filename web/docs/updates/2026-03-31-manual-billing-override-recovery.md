---
title: "Manual billing override recovery for Stripe-backed accounts"
date: "2026-03-31"
audiences:
  - "ADMIN"
areas:
  - "Billing"
summary: "Added an admin billing ops action to clear a manual override and restore Stripe-owned billing from existing provider state without requiring another payment."
---

# Manual billing override recovery for Stripe-backed accounts

## What changed
- Added a new admin billing action to return an account from `billing_source = manual` back to Stripe-owned billing.
- The recovery action re-fetches the stored Stripe subscription, restores `billing_source = stripe`, clears `max_listings_override`, and preserves Stripe identifiers/history.
- Admin billing UI now exposes `Return to Stripe billing` when the current account is under a manual billing override.

## Why this was needed
- A paid account could remain stuck showing `Free / Manual` because manual override state masked valid Stripe subscription truth underneath.
- Support needed a clean recovery path that did not require another paid smoke test.

## Recovery behavior
- Works only when the account is currently under a manual override.
- Uses the stored Stripe subscription id when available.
- Falls back to the latest Stripe subscription row in `subscriptions` if the plan row no longer has the subscription id.
- Fails safely if no linked Stripe subscription can be found or the Stripe subscription does not map to a known PropatyHub tier.

## Rollback
- `git revert <sha>`
