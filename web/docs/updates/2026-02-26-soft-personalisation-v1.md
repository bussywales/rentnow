---
title: "Recommended next (local-first personalisation)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - Retention
summary: "Added a market-scoped, local-first Recommended next rail on mobile home using saved, viewed, and browse signals with deterministic, non-sensitive ranking."
published_at: "2026-02-26"
---

## What changed

- Added a local recommendation engine that combines:
  - saved favourites,
  - recently viewed items,
  - last browse/search URL context,
  - market-aware discovery taxonomy fallback.
- Added a new **Recommended next** rail on mobile home (`/`) above the generic listing rails.
- Recommendations are deterministic, market-scoped (NG/CA/GB/US with GLOBAL fallback), and avoid re-suggesting exact saved/viewed IDs.

## Trust & privacy notes

- Local-first only: no backend calls, no profile sync, no demographic inference.
- Recommendation reasons are transparent and generic:
  - `Continue browsing`
  - `Based on your saved`
  - `Because you viewed`
  - `Popular in your market`
