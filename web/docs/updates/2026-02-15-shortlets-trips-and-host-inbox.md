---
title: "Shortlet trips + host bookings inbox upgrades"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Tenant
  - Host Dashboard
  - Ops
cta_href: "/trips"
published_at: "2026-02-15"
---

What changed:
- Added tenant **Trips** pages:
  - `/trips` for booking inbox with filters (Upcoming, Pending, Past, Cancelled, All)
  - `/trips/[id]` for booking detail and status guidance
- Added tenant booking detail API endpoint:
  - `GET /api/shortlet/bookings/[id]/mine`
- Added host pending count endpoint:
  - `GET /api/shortlet/bookings/pending-count`
- Updated host dashboard to show:
  - **Bookings (X)** pending badge count
  - top callout: “You have X booking requests” with quick shortcut to bookings

Why it matters:
- Tenants now have a clear, Airbnb-style trip flow from request to stay.
- Hosts and delegated agents can spot and clear pending requests faster.
- Support and ops teams have clearer visibility for status-driven triage.

Operational notes:
- Manual payouts remain unchanged for the pilot.
- No changes were made to Paystack, referrals, or cashout logic.
