---
title: "Featured homes now show first on mobile home"
audiences:
  - TENANT
areas:
  - Tenant
  - Home
  - Discovery
  - UX
summary: "Restored the mobile Featured homes hook under Quick Start, removed a dev 404 source, and added a fallback rail path when featured inventory is unavailable."
published_at: "2026-02-26"
---

## What changed

- Mobile `/` now resolves home listing rails directly on the server instead of calling an external base URL for `/api/properties/search`.
- The first mobile rail (`Featured homes`) now has a graceful fallback:
  - uses popular homes when featured inventory is empty/unavailable
  - uses new homes when popular inventory is also unavailable
- Added regression guards so home mobile smoke tests assert the Featured homes rail appears before discovery interactions.

## Why this helps

- Keeps the listings-first hook intact under Quick Start.
- Prevents environment URL drift from removing the Featured homes section in local/dev flows.
- Preserves a useful, listing-style first rail even when featured inventory is temporarily unavailable.
