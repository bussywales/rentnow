---
title: "Explore Pager V3 gating hotfix"
areas: [Explore, Mobile, Performance]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Relaxed Explore Pager V3 advance gating so vertical swipes can continue when the next listing exists, even if that listing has no image records yet.
- Kept snap-back behavior only for true blocked edges (missing next/previous listing).
- Added a dev-only one-time pager breadcrumb to diagnose next-index and image-count gate checks without noisy logging.

## Why
- The previous gate required a "usable image" and could block normal vertical paging on slower/partial data scenarios.
- Explore galleries already render placeholder/fallback layers, so paging should proceed when a listing exists.
