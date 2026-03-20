---
title: "Featured payments canonical model"
date: "2026-03-20"
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - featured
---

## What was found

Featured monetisation was split across two backend lanes:

- `payments` + `featured_purchases` for approved featured-request activations
- `feature_purchases` for PAYG featured listing charges from the listing checkout flow

That meant `/admin/payments` could look like the whole featured payment estate even though it primarily reflected only the first lane.

## What canonical model was chosen

For the initial live scope, the canonical featured-payment model is:

- `payments` + `featured_purchases`

This is now the model admins should trust first for launch-critical featured payment operations, reconciliation, and activation troubleshooting.

## What was implemented now

- Added a durable decision doc at `docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md`
- Updated `/admin/payments` copy and layout to make canonical vs legacy scope explicit
- Added a secondary read-only section for legacy PAYG featured listing charges from `feature_purchases`
- Updated the pre-live hardening plan to record the phase-4 decision

## What remains

- PAYG featured listing charges still use the legacy `feature_purchases` lane
- full backend consolidation of featured monetisation remains for a later phase
- non-Paystack / non-NGN featured monetisation is still out of initial live scope

## Rollback

- `git revert <sha>`
