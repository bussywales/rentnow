---
title: "Admin demo toggle confirmation no longer navigates away"
areas: [Admin, Listings, UI]
audiences: [ADMIN]
published_at: "2026-03-05"
---

## What changed
- Fixed the `/admin/listings` "Mark as demo" confirmation flow so confirm/cancel actions do not trigger row navigation.
- Confirm now updates demo state in place and keeps admins on the listings registry.

## Rollback plan
- Revert commit `fix(admin): prevent demo confirm from navigating away` if regressions appear.
