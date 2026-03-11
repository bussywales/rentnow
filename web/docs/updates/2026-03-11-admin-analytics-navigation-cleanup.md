---
title: "Admin analytics navigation cleanup"
audiences: [ADMIN]
areas: [admin, analytics, navigation]
published_at: "2026-03-11"
---

## What changed
- Renamed the admin control-panel shortcut from `Insights` to `Analytics` and pointed it to `/admin/analytics`.
- Updated admin global navigation labels to use `Analytics` instead of `Insights`.
- Added a shared analytics sibling navigation row across:
  - `/admin/analytics`
  - `/admin/analytics/explore`
  - `/admin/analytics/explore-v2`
- Added a first-class `Analytics destinations` section on `/admin/analytics` with clear cards for:
  - Marketplace analytics
  - Explore analytics
  - Explore V2 conversion

## Why
- Improves analytics discoverability from the admin control panel.
- Reduces IA ambiguity by keeping one top-level analytics entry and clear second-level destinations.
- Makes lateral movement between analytics workspaces faster for admin operators.

## Rollback
- Revert commit: `git revert <sha>`.
