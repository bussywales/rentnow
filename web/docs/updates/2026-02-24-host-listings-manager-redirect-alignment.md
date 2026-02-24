---
title: "Host listings manager now opens in manage mode from legacy routes"
audiences:
  - HOST
  - AGENT
areas:
  - Host
  - Listings
  - Routing
cta_href: "/host/listings?view=manage"
published_at: "2026-02-24"
---

## What changed

- Updated legacy `/dashboard/properties` redirects to land on `/host/listings?view=manage`.
- Updated invalid-id fallbacks from legacy dashboard listing routes to the same canonical manager view.
- Updated host listings manager view parsing so:
  - `?view=manage` opens manager mode.
  - legacy `?view=all` maps to the portfolio feed mode.
  - default local view now favors manager mode.

## Why it matters

- “Manage all” and legacy listing-management entry points now converge on one stable manager surface.
- Hosts and agents avoid dead-end route confusion and land directly in operational mode.
