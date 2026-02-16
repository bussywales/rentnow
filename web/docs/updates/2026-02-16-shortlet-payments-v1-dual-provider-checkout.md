---
title: "Shortlet payments v1: dual-provider checkout"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Payments
  - Bookings
  - Notifications
cta_href: "/trips"
published_at: "2026-02-16"
---

What changed:
- Added a shortlet checkout step after date selection with two provider options:
  - **Pay by Card (recommended)** via Stripe
  - **Pay with Nigerian methods** via Paystack
- Added new shortlet payment init endpoints:
  - `POST /api/shortlet/payments/stripe/init`
  - `POST /api/shortlet/payments/paystack/init`
- Added shortlet payment status polling endpoint:
  - `GET /api/shortlet/payments/status?booking_id=...`
- Added Stripe webhook support for shortlet bookings and extended Paystack webhook handling for shortlet booking payments.
- Booking confirmation now happens only after successful payment:
  - request mode: `pending_payment` -> `pending`
  - instant mode: `pending_payment` -> `confirmed`
- Added provider feature flags in app settings:
  - `shortlet_payments_stripe_enabled`
  - `shortlet_payments_paystack_enabled`
  - `shortlet_auto_payouts_enabled` (default false, placeholder for future automation)

Why it matters:
- Tenants get a clear payment choice and reliable booking confirmation flow.
- Hosts only receive actionable paid requests and confirmed reservations.
- Webhook replay safety prevents duplicate booking transitions.

Operational notes:
- Nigeria shortlets continue to use NGN as source-of-truth for charges.
- Automated host payouts remain disabled for this pilot.
