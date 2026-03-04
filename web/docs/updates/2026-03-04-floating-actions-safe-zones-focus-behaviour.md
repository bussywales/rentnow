---
title: "Floating Help/Map safe zones and focus-aware behaviour on mobile"
areas: [PWA, Search, UI]
audiences: [TENANT]
published_at: "2026-03-04"
---

## What changed
- Added a shared floating action rail for mobile floating controls so Help and Map actions follow one consistent placement rule above the dock safe zone.
- Floating Help/Map actions now avoid key search surfaces and automatically fade out while a form input is focused, preventing overlap with primary fields.
- Updated mobile interaction polish for floating actions with consistent glass styling, 44px tap targets, and immediate press feedback.

## Rollback plan
- Revert commit `feat(pwa): prevent floating actions overlapping search inputs` if regressions appear.
