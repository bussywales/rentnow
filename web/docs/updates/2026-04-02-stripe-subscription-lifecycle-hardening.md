---
title: "Harden Stripe subscription lifecycle management after UK launch"
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - Billing
  - Payments
cta_href: "/dashboard/billing"
published_at: "2026-04-02"
---

## 2026-04-02 - Stripe subscription lifecycle hardening

This batch hardened post-purchase Stripe subscription management for PropatyHub / RentNow.

### What changed

- Added a shared subscription lifecycle resolver for:
  - free baseline
  - manual override
  - active paid subscription
  - cancelled at period end
  - payment issue
  - expired
- Wired `Manage subscription` to the real Stripe customer portal only when the loaded account is:
  - Stripe-backed
  - lifecycle-eligible
  - linked to both a Stripe customer and subscription id
- Moved the Stripe portal return back to the correct billing page:
  - tenants return to `/tenant/billing`
  - landlords and agents return to `/dashboard/billing`
- Added a portal-return billing notice so the refreshed state is obvious after coming back from Stripe.
- Hardened billing summaries to show lifecycle state, renewal/access-until dates, cancellation-requested state, and Stripe status.
- Extended `/admin/billing` to surface lifecycle state, cancellation-requested timing, and the latest relevant Stripe lifecycle event for the loaded account.

### Safety

- Free, manual, and non-Stripe accounts do not get a broken customer-portal path.
- Manual override protections were not weakened.
- This batch stayed Stripe-focused only and did not change Paystack or Flutterwave lifecycle ownership behavior.
