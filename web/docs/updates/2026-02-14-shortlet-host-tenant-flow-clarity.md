---
title: "Shortlet host + tenant flow completion (pilot)"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Host Dashboard
  - Tenant
  - Ops
cta_href: "/shortlets"
published_at: "2026-02-14"
---

What changed:
- Added a dedicated shortlet discovery page at `/shortlets` and linked it from `/properties`.
- Added tenant **My bookings** page at `/tenant/bookings` with upcoming/past sections and cancel action.
- Upgraded host shortlet operations in `/host` with a two-tab workspace:
  - **Bookings** (incoming + upcoming + actions)
  - **Availability & pricing** (nightly price + rules editor)
- Added host-side cancel action for confirmed bookings and optional action reasons in booking actions.
- Added host API route to update shortlet settings: `PATCH /api/shortlet/settings/[propertyId]`.

Why it matters:
- Tenant and host flows are now clearer and complete for pilot operations.
- Shortlet pricing/rules are manageable directly from host dashboard.
- Booking lifecycle actions are available where teams operate daily.

Operational notes:
- Manual payouts remain unchanged.
- No Paystack shortlet payment automation added in this pass.
