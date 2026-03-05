---
title: "GlassDock tap feedback and active-state responsiveness on mobile"
areas: [PWA, Navigation, UI]
audiences: [TENANT]
published_at: "2026-03-05"
---

## What changed
- Improved GlassDock tap responsiveness on mobile so dock items provide instant pressed feedback while navigation is in progress.
- Added optimistic active highlighting to make selected state update immediately even when route transitions are delayed.
- Added a subtle per-item loading cue for slower navigations and reinforced minimized-state tap reliability with explicit hit targets and pointer-event safety.

## Rollback plan
- Revert commit `feat(pwa): improve dock tap feedback and active-state responsiveness` if regressions are found.
- If urgent, disable the mobile dock via existing configuration while rollback deploys.
