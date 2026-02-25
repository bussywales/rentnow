---
title: "Shortlets: Featured discovery rail"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - Shortlets
summary: "Added a market-aware featured rail to shortlets search using the shared static discovery taxonomy."
published_at: "2026-02-25"
---

## What changed

- Added a new mobile-first featured rail near the top of `/shortlets` with snap/peek scrolling.
- Powered the rail with the shared market-aware discovery taxonomy (`SHORTLETS_FEATURED` surface) and deterministic selection.
- Kept interaction safe and predictable: featured cards route to `/shortlets?...` with market-safe params.
- Kept existing shortlets search behaviour intact (sticky controls, filters, and map open/close flow unchanged).
