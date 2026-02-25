---
title: "Collections v1 (shareable discovery pages)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - SEO
summary: "Added static market-aware collection pages with shareable slugs and one-tap routing into shortlets or properties results."
published_at: "2026-02-25"
---

## What changed

- Added shareable static collection pages under `/collections/<slug>` using the market discovery taxonomy.
- Added a collections registry with deterministic, market-aware card selection and safe fallbacks.
- Added a minimal `/collections` index page for discovery.
- Added “View results” CTA routing into existing `/shortlets` or `/properties` URL flows (no backend/API changes).
- Added unit and mobile go-live smoke coverage for collections rendering and routing.

