---
title: "Shortlets map markers now render more smoothly at higher result counts"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Search
  - Performance
cta_href: "/shortlets"
published_at: "2026-02-20"
---

## What changed

- Reused marker icon instances across map renders so hover/selection updates avoid recreating identical icons.
- Added threshold-based marker clustering for large result sets while keeping existing selection, preview, and list-coupling behaviour.
- Preserved manual and auto map search behaviour (`Search this area` and `mapAuto=1`) with no URL contract changes.
