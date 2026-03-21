---
title: Admin listings action UI cleanup
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - ux
---

- Cleaned up the `/admin/listings` row actions so the labels are shorter and easier to scan.
- `Open` is now `View`, because the action opens the admin listing inspector rather than a public listing page.
- Featured and demo actions are now state-aware:
  - `Feature` / `Unfeature`
  - `Set demo` / `Remove demo`
- The action row also has a clearer hierarchy, with `View` treated as the primary quick action and the toggle controls kept tighter beside it.
- Rollback: `git revert <sha>`
