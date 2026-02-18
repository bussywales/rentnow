---
title: "Shortlet calendar now blocks unavailable dates before checkout"
audiences:
  - TENANT
  - HOST
areas:
  - Shortlets
  - Bookings
  - Checkout UX
cta_href: "/properties?stay=shortlet"
published_at: "2026-02-18"
---

## What changed

- Replaced native shortlet check-in/check-out inputs with an availability-aware calendar range picker.
- Booked and blocked nights are now visibly disabled in the calendar before selection.
- Added smarter date-range validation so invalid ranges are prevented before "Continue to payment" is enabled.

## Who it affects

- Tenant: date selection is clearer and avoids retry loops from late availability errors.
- Host/Agent: fewer failed booking attempts caused by selecting unavailable nights.

## Where to find it

- `/properties/[id]` shortlet booking widget
