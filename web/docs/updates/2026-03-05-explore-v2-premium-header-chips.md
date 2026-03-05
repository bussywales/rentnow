---
title: "Explore V2 premium header and filter chips"
areas: [Explore V2, UI, Discovery]
audiences: [TENANT]
published_at: "2026-03-05"
---

## What changed
- Added a calmer Explore V2 header with a live filter summary so tenants can quickly read the active browsing context.
- Added a premium chip row for `Market`, `Type`, `Beds`, and `Budget`, each opening a lightweight bottom sheet selector.
- Added clear-reset controls and client-side filtering so feed updates stay fast without changing backend APIs.

## Rollback plan
- Revert commit `feat(explore-v2): add premium header and filter chips` if regressions appear.
- If urgent, disable Explore through the existing kill switch while rollback deploys.
