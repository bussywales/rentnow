---
title: "Admin: Discovery catalogue diagnostics"
audiences:
  - ADMIN
areas:
  - Admin
  - Ops
  - Discovery
summary: "Added a read-only admin diagnostics page for discovery and collections catalogue health, with market/surface counts and validator reason codes."
published_at: "2026-02-26"
---

## What changed

- Added a new admin-only diagnostics page at `/admin/discovery`.
- Added read-only health visibility for discovery taxonomy and collections static registry:
  - counts by market (`GLOBAL`, `NG`, `CA`, `UK`, `US`)
  - counts by surface (`HOME_FEATURED`, `SHORTLETS_FEATURED`, `PROPERTIES_FEATURED`, `COLLECTIONS`)
  - invalid/filtered entry list with validator reason codes
  - disabled / not-yet-active / expired totals
  - routing sanity counts for missing route-driving params
- Added build metadata context (commit and app version) to help ops verify what release they are checking.
- Extended admin go-live smoke coverage to assert diagnostics page renders without runtime console errors.
