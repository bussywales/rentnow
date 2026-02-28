---
title: "Explore scrolling is smoother (performance micro-wins)"
audiences:
  - TENANT
areas:
  - Tenant
  - Explore
  - UX
summary: "Explore now preloads only active/adjacent hero images when safe, trims avoidable rerenders, and adds guards to prevent performance backslides."
published_at: "2026-02-28"
---

## What changed

- Tightened image preload work to active and adjacent slides only, using idle scheduling and save-data/gesture safeguards.
- Memoised small Explore UI overlays and stabilised handlers to reduce avoidable rerenders during browsing.
- Added regression tests to guard preload limits and ensure details-sheet heavy content remains lazy-mounted.

## Why this helps

- Smoother swipe and paging performance, especially on older mobile devices.
- Lower background work while users are actively interacting.
- Better stability against future performance regressions.
