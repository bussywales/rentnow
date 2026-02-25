---
title: "Properties: Featured discovery rail"
audiences:
  - TENANT
  - HOST
areas:
  - Tenant
  - Discovery
  - Properties
summary: "Added a market-aware featured discovery rail to the top of the properties browse page on mobile-first layouts."
published_at: "2026-02-25"
---

## What changed

- Added a new mobile-first featured discovery rail near the top of `/properties` with snap/peek scrolling.
- Powered the rail with the shared static discovery taxonomy (`PROPERTIES_FEATURED` surface) and market-aware deterministic selection.
- Featured cards route into `/properties?...` with category/filter params, so users stay in existing properties browse flows.
- Kept existing properties search/filter behavior unchanged, including category chips, smart search, and results grid handling.
