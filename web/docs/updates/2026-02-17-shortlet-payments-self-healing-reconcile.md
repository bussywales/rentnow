---
title: "Shortlet payments: self-healing reconcile and confirmation hardening"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Payments
  - Bookings
published_at: "2026-02-17"
---

What changed:
- Added a self-healing reconcile path for shortlet payments at:
  - `POST /api/internal/shortlet/reconcile-payments` (cron-secret protected).
- Added reconcile tracking fields on `shortlet_payments` for lock, attempts, and reason diagnostics.
- Hardened canonical payment success handling so payment success + booking transition is idempotent and centralized.
- Updated return-page actions with a throttled **Force re-check** path for Paystack.
- Added DB trigger safety net so succeeded payment rows can auto-transition booking from `pending_payment` to:
  - `pending` for request mode
  - `confirmed` for instant mode

Booking status is authoritative:
- The return page now keeps polling only while booking is `pending_payment`.
- Once booking becomes `pending`, UI switches to "awaiting host approval" and polling stops.

Why it matters:
- Reduces stuck states where payment succeeds but booking transition lags.
- Improves recovery from transient webhook/verification misses.
- Gives clearer operational visibility into reconcile reasons and retries.
