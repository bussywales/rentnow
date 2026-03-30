---
title: UK subscription Stripe linkage completed
date: 2026-03-30
audiences:
  - ADMIN
areas:
  - billing
  - subscriptions
  - pricing
  - stripe
summary: Linked all six canonical UK subscription_price_book rows to the corrected live Stripe recurring price IDs and removed the temporary UK legacy Stripe-ref bridge so display pricing and new checkout resolution now align to canonical truth.
---

# 2026-03-30 UK subscription Stripe linkage completed

## What changed

- Linked all six canonical UK `subscription_price_book` rows to the corrected live Stripe recurring price IDs.
- Removed the temporary UK legacy Stripe-ref bridge from runtime subscription resolution.
- UK billing display and new checkout resolution now depend on canonical `subscription_price_book` truth plus linked Stripe refs, not stale env-backed UK fallback.
- The admin subscription price matrix now shows linked UK provider refs and clears the previous missing-ref and checkout-drift diagnostics for corrected UK rows.

## Rollback

- Revert the application change: `git revert <sha>`
- Revert the data linkage migration by applying an inverse SQL update for the six UK `provider_price_ref` values if the deployed database state also needs to be rolled back.
