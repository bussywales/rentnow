---
title: "Recently viewed & continue browsing (local-first)"
audiences:
  - TENANT
  - HOST
areas:
  - Tenant
  - Retention
  - UX
summary: "Added a local-first recently viewed loop with market-aware mobile home rail and continue-browsing cues on Shortlets/Properties, using browser storage only."
published_at: "2026-02-26"
---

## What changed

- Added a local recently viewed store (`localStorage`) with market and listing-kind scoping.
- Discovery taps now record recently viewed entries across:
  - home featured strip,
  - shortlets featured rail and list cards,
  - properties featured rail and listing cards,
  - collections cards.
- Added **Recently viewed** rail on mobile home.
- Added **Continue browsing** cues:
  - `/shortlets` (restores last filtered shortlets URL),
  - `/properties` (restores last filtered properties URL).

## Notes

- Local-only storage; no backend sync in v0.
- Stored fields are minimal: id, kind, market, href, title/subtitle/tag, timestamp.
- Continue-browsing state only stores whitelisted browse URLs (`/shortlets?...`, `/properties?...`).
