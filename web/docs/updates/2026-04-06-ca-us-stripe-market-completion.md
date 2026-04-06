---
title: "Canada and US Stripe market completion"
audiences:
  - "ADMIN"
areas:
  - "billing"
  - "payments"
cta_href: "/admin/settings/billing/prices"
published_at: "2026-04-06T18:15:00Z"
summary: "Completed the Canada and United States Stripe subscription path by adding canonical North America price-book rows, replacing silent GBP fallback with explicit cross-currency billing disclosure, and persisting market metadata on Stripe webhook events for billing ops diagnostics."
---

# Canada and US Stripe market completion

## What changed

- Added canonical Stripe subscription rows for `CA` and `US` in `subscription_price_book`.
- Extended canonical Stripe enforcement beyond UK-only rows.
- Replaced hidden runtime fallback semantics with explicit cross-currency billing disclosure for Canada and United States.
- Persisted `subscription_market_country` and `subscription_market_currency` on `stripe_webhook_events`.
- Hardened Stripe webhook plan resolution so shared Stripe price refs are disambiguated by subscription checkout market metadata.

## Operator impact

- Canada and United States no longer appear as vague fallback Stripe markets.
- Billing ops can see which market a Stripe webhook event belongs to.
- Admin price-matrix diagnostics now distinguish cross-currency canonical checkout from accidental runtime fallback.

## Important scope note

- This batch does **not** launch Nigeria on Stripe.
- Nigeria remains outside this Stripe completion path and still needs Paystack-first work later.
