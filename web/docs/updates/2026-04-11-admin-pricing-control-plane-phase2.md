---
title: Admin Pricing Control Plane Phase 2
slug: admin-pricing-control-plane-phase2
date: 2026-04-11
summary: Extended the subscription pricing control plane so admins can create Stripe recurring prices from canonical drafts, bind the returned `price_...` ref automatically, and publish only when the draft is safe.
audiences:
  - ADMIN
areas:
  - billing
  - admin
cta_href: "/admin/settings/billing/prices"
published_at: 2026-04-11
---

## What changed

- Admin users can now create a Stripe recurring price from a canonical subscription draft inside `/admin/settings/billing/prices`.
- The created `price_...` ref is bound back onto the draft automatically.
- Publish still remains explicit. Creating a Stripe price does not publish the draft.
- If amount, currency, or cadence changes after a Stripe ref has been bound, the old binding is cleared so the draft cannot silently publish against a stale Stripe price.

## Operational model

- PropatyHub canonical pricing remains the pricing truth.
- Stripe price objects are execution refs created from canonical drafts.
- Safe rollout pattern:
  1. save draft
  2. create and bind Stripe recurring price
  3. validate draft
  4. publish intentionally

## Scope limits

- This batch does not add full Stripe product catalogue management.
- Historical Stripe price retirement remains manual if needed.
- Paystack and Flutterwave subscription execution remain out of scope.
