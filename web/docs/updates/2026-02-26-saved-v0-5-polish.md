---
title: "Saved favourites improved (sections + bulk actions)"
audiences:
  - TENANT
areas:
  - Tenant
  - Retention
  - UX
summary: "Saved now has a dedicated local-first page with Shortlets/Properties sections, per-item remove, clear-all confirm, and market-aware empty-state suggestions."
published_at: "2026-02-26"
---

## What changed

- Replaced `/saved` redirect behaviour with a dedicated local-first saved page.
- Added sectioned saved lists:
  - **Saved Shortlets**
  - **Saved Properties**
- Added bulk actions:
  - remove individual item,
  - clear section,
  - clear all with confirmation.
- Added market-aware empty-state suggestions powered by static discovery taxonomy selectors.
- Linked tenant canonical route `/tenant/saved` to `/saved`.

## Notes

- This remains local-only (no backend sync).
- Saved data continues to be market-scoped and SSR-safe.
