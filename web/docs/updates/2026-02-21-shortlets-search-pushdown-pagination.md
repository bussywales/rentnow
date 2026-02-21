---
title: "Shortlets search query is now paged and filter-pushed"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Search
  - Performance
published_at: "2026-02-21"
---

## What changed

- `/api/shortlets/search` now supports cursor pagination via `limit` and `cursor` while preserving existing `page` and `pageSize` behaviour.
- Search route baseline fetches are reduced by using an adaptive source-row limit instead of always loading a large fixed set.
- Location and map-bounds filters are applied earlier in the DB query path before in-memory ranking and availability pruning.

## Why it matters

- Faster response times under larger inventories.
- Lower memory and profile lookup overhead on the API path.
- Stable sort and result order are preserved for the same input.

## Where to validate

- `/api/shortlets/search?limit=40`
- `/api/shortlets/search?limit=40&cursor=40`
