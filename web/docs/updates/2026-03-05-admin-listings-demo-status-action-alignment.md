---
title: "Admin listings registry demo status and action alignment"
areas: [Admin, Listings, UI]
audiences: [ADMIN]
published_at: "2026-03-05"
---

## What changed
- Polished `/admin/listings` so demo status is visible in the actions cluster beside demo controls.
- Added an actions-column `Demo` pill near the `Mark as demo / Remove demo` button.
- Demo status now updates optimistically in the row so the button label and pill reflect the new state immediately.

## Rollback plan
- Revert commit `feat(admin): align demo status with demo action in listings registry` if regressions appear.
