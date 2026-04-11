---
title: "CA/US local-currency Stripe completion"
audiences:
  - "ADMIN"
areas:
  - "billing"
  - "payments"
cta_href: "/admin/settings/billing/prices"
published_at: "2026-04-11"
summary: "Completed Canada and United States Stripe subscription pricing by replacing the interim GBP-backed canonical rows with real CAD/USD recurring Stripe refs and removing the pending local-currency gate for those markets."
---

# CA/US local-currency Stripe completion

## What changed

- Canada canonical subscription rows now point to live `CAD` recurring Stripe prices.
- United States canonical subscription rows now point to live `USD` recurring Stripe prices.
- The CA/US truth-preserving gate remains in the resolver as a guardrail, but it no longer blocks those markets because the canonical rows are now market-aligned.
- Admin billing diagnostics now show CA/US as aligned canonical Stripe markets instead of pending local-currency completion.

## Exact Stripe refs now linked

- `CA` / `CAD`
  - Tenant monthly: `price_1TKaEcPjtZ0fKtkBYl45ZvF0`
  - Tenant yearly: `price_1TKaFCPjtZ0fKtkBWKJArOEU`
  - Landlord monthly: `price_1TKaJDPjtZ0fKtkBISh35BGf`
  - Landlord yearly: `price_1TKaJfPjtZ0fKtkB7GnRxQWJ`
  - Agent monthly: `price_1TKaUKPjtZ0fKtkBR72YdK8H`
  - Agent yearly: `price_1TKaUoPjtZ0fKtkBEK9hmPSq`
- `US` / `USD`
  - Tenant monthly: `price_1TKaGbPjtZ0fKtkBqRESXfcm`
  - Tenant yearly: `price_1TKaGwPjtZ0fKtkBxC84foEX`
  - Landlord monthly: `price_1TKaK0PjtZ0fKtkBvMrNwDOn`
  - Landlord yearly: `price_1TKaKXPjtZ0fKtkBCDLk8uah`
  - Agent monthly: `price_1TKaVBPjtZ0fKtkBtyUMIh0C`
  - Agent yearly: `price_1TKaVTPjtZ0fKtkB3Df0WQbo`

## Scope note

- This batch does not change UK pricing.
- This batch does not touch Nigeria / Paystack.
- This batch replaces the CA/US pending gate with final local-currency canonical completion.
