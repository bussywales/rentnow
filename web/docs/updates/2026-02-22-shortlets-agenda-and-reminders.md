---
title: "Shortlets host agenda and reminder operations"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Host
  - Trips
cta_href: "/host/calendar"
published_at: "2026-02-22"
---

## What changed

- Added a host **Check-in agenda** panel on `/host/calendar` with `Today`, `Tomorrow`, and `Next 7 days` buckets.
- Added an internal shortlet reminder worker route (`/api/internal/shortlet/send-reminders`) with idempotent reminder-event logging.
- Added host one-click action in booking details: **Send check-in details now** for confirmed paid stays with configured check-in data.

## Who it affects

- Tenant:
  - Receives clearer pre-arrival and checkout reminders in-app and by email.
- Host/Agent:
  - Gets better operational visibility for upcoming arrivals and can share check-in details proactively.
- Admin:
  - Gains a cron-safe reminder operation with deterministic idempotency.

## Where to find it

- `/host/calendar`
- `/host/bookings`
- `/api/internal/shortlet/send-reminders`
