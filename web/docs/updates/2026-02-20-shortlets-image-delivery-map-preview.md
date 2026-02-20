---
title: "Shortlets map preview now prefers lightweight image delivery"
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

- Added a dedicated `mapPreviewImageUrl` field in shortlet search results so map cards can prefer lightweight preview assets.
- Updated the selected-map preview card to render with `next/image` and small responsive sizing for faster, steadier loads.
- Kept listing and map behaviour unchanged while reducing map preview image payload pressure.
