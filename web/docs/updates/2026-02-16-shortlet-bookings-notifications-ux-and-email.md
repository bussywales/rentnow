---
title: "Shortlet bookings UX updates and transactional email alerts"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Bookings
  - Notifications
  - Navigation
cta_href: "/trips"
published_at: "2026-02-16"
---

What changed:
- Added stronger booking entry points for tenants:
  - `Trips` link in main navigation for signed-in tenants
  - `Trips` quick action in tenant workspace and a `My trips` button in tenant home shortlet section
  - booking widget success notice now includes a direct `My trips` link
- Improved host booking visibility on `/host`:
  - `Bookings (X)` workspace toggle with pending request count
  - callout when requests are waiting approval, linking to `/host?tab=bookings`
  - callout when shortlets are missing nightly price, linking directly to shortlet settings
- Added shortlet transactional email notifications with event-level idempotency:
  - request submitted: host + tenant emails
  - request approved: tenant + host confirmation emails
  - request declined: tenant email
  - instant reservation: host + tenant emails

Why it matters:
- Tenants can quickly track active shortlet requests and confirmed stays.
- Hosts and agents can act on booking requests without digging into listing cards.
- Retries on booking endpoints no longer spam duplicate booking emails.

Operational notes:
- Email dispatch uses existing Resend integration and remains controlled by `SHORTLET_BOOKING_EMAILS_ENABLED`.
- Manual payouts and payment provider flows remain unchanged.
