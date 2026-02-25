---
title: "Mobile shortlets: Map button is easier to tap"
audiences:
  - TENANT
areas:
  - Tenant
  - Shortlets
  - UX
summary: "Adjusted mobile support button positioning on shortlets so it no longer overlaps the Map button tap zone."
published_at: "2026-02-25"
---

## What changed

- Moved the mobile Support widget button into a route-specific safe zone on `/shortlets` so it does not sit on top of the Map CTA.
- Kept map open/close behaviour unchanged.
- Removed the Playwright workaround that force-closed support during mobile map assertions.
- Added regression guards to prevent future support/map overlap in mobile shortlets flows.
