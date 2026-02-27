---
title: "Offline mode now shows useful local picks by route"
audiences:
  - TENANT
areas:
  - Tenant
  - PWA
  - UX
summary: "Offline mode now adapts to where you came from and surfaces saved homes, saved searches, recently viewed items, and local recommendations."
published_at: "2026-02-27"
---

## What changed

- Upgraded offline fallback to pass route context into `/offline` so the page can tailor what it shows.
- Replaced the generic offline page with a route-aware shell that uses local-first data:
  - Saved homes
  - Saved searches (local browse/search context)
  - Recently viewed
  - Recommended next (when available)
- Added a collections-specific offline note and a cleaner empty state when no local data exists.

## Why this helps

- Tenants see useful content while offline instead of a dead-end message.
- The offline experience now matches the route they came from and keeps browsing momentum.
