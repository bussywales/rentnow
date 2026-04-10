---
title: "CA/US local-currency Stripe gate"
audiences:
  - "ADMIN"
areas:
  - "billing"
  - "payments"
cta_href: "/admin/settings/billing/prices"
published_at: "2026-04-09"
summary: "Blocked Canada and United States Stripe checkout until real local-currency recurring Stripe prices are linked, and updated admin price-book notes so CA/US no longer present GBP checkout as an acceptable state."
---

# CA/US local-currency Stripe gate

## What changed

- Canada and United States subscription checkout now require market-aligned Stripe pricing.
- Canonical CA/US rows that still point at GBP recurring Stripe prices are treated as unavailable rather than acceptable checkout paths.
- Admin/operator notes for the active CA/US canonical rows are updated to show that real CAD/USD recurring Stripe prices are still missing.

## Exact missing external inputs

The connected Stripe setup still needs these recurring subscription prices before CA/US can be truly completed:

- `CA` / `CAD`: tenant monthly, tenant yearly, landlord monthly, landlord yearly, agent monthly, agent yearly
- `US` / `USD`: tenant monthly, tenant yearly, landlord monthly, landlord yearly, agent monthly, agent yearly

Each local-currency Stripe price must then be linked into `subscription_price_book` with the matching `amount_minor` and `provider_price_ref`.

## Important scope note

- This batch does not change UK Stripe pricing.
- This batch does not touch Nigeria / Paystack.
- This is an explicit local-currency gate, not another cross-currency interim state.
