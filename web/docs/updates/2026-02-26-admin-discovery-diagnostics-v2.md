---
title: "Admin: Discovery diagnostics upgraded (coverage + exports)"
audiences:
  - ADMIN
areas:
  - Admin
  - Ops
  - Discovery
summary: "Extended `/admin/discovery` with market/surface coverage scoring, top-risk visibility, broken-route auditing, and CSV exports for ops reviews."
published_at: "2026-02-26"
---

## What changed

- Upgraded `/admin/discovery` diagnostics with actionable coverage scoring across all supported markets (`GLOBAL`, `NG`, `CA`, `UK`, `US`) and surfaces (`HOME_FEATURED`, `SHORTLETS_FEATURED`, `PROPERTIES_FEATURED`, `COLLECTIONS`).
- Added a top-risks panel that flags market/surface combinations below configurable thresholds.
- Added a broken route and parameter audit for:
  - featured discovery rail routes
  - collection page links
  - collection result CTAs
- Added CSV exports for:
  - coverage summary
  - invalid entries
  - broken route audit rows
- Added unit test coverage for coverage math, route auditing, and CSV generation.
- Extended admin go-live smoke assertions to verify v2 diagnostics sections and export controls render.
