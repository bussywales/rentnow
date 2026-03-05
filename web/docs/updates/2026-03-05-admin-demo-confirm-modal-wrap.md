---
title: "Admin demo confirmation modal copy wrapping fix"
areas: [Admin, Listings, UI]
audiences: [ADMIN]
published_at: "2026-03-05"
---

## What changed
- Fixed the `/admin/listings` demo confirmation modal so explanatory copy wraps cleanly within the dialog.
- Added safer width and text-wrapping classes to prevent overflow on desktop and mobile.

## Rollback plan
- Revert commit `fix(admin): wrap demo confirmation modal copy` if regressions are observed.
