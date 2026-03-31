---
title: "Canonical Stripe webhook plan replay fix"
date: "2026-03-31"
audiences:
  - "ADMIN"
areas:
  - "Billing"
  - "Stripe"
summary: "Updated Stripe billing webhook plan resolution to honor canonical subscription price-book Stripe price refs so ignored live events can be replayed through the normal provider-owned path."
---

# Live Stripe webhook plan replay fix

- Fixed Stripe billing webhook plan resolution so canonical `subscription_price_book.provider_price_ref` values are accepted when env-backed Stripe price mapping is absent.
- This specifically unblocks live canonical UK subscription price IDs, including tenant monthly `price_1TGlYzPjtZ0fKtkBRTYNfytj`.
- The replay route can now reprocess previously ignored Stripe billing events through the normal provider-owned path once the updated runtime is live.

### Operational note

- Replay target for the blocked live tenant payment: `evt_1TH2VVPjtZ0fKtkBnzKo7nHE`
- Expected outcome after replay:
  - `profile_plans.billing_source = stripe`
  - `profile_plans.plan_tier = tenant_pro`
  - `profile_plans.stripe_price_id = price_1TGlYzPjtZ0fKtkBRTYNfytj`

### Rollback

- `git revert <sha>`
