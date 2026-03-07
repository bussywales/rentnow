---
title: "Admin report added for Explore V2 conversion micro-sheet funnel metrics"
areas: [Admin, Analytics, Explore-V2]
audiences: [ADMIN]
published_at: "2026-03-06"
---

## What changed
- Added `/admin/analytics/explore-v2` with filterable KPI reporting for Explore V2 micro-sheet conversion events.
- Added market and intent filtering (`ALL`, `NG`, `GB`, `CA`, `US` and `shortlet`, `rent`, `buy`) with default last-7-day range.
- Added CSV export for the current filter set via `/api/admin/analytics/explore-v2?format=csv`.

## Rollback plan
- Revert commit `feat(admin): add explore v2 conversion analytics report`.
- If urgent, remove access path by reverting only the new admin route/page files while keeping analytics ingest unchanged.
