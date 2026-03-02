---
title: "Explore now keeps market picks first with clearer fallback continuity"
summary: "Explore now prioritises current-market listings, then clearly labels fallback listings as More to explore to keep feed depth consistent in lower-supply markets."
areas: [Tenant, Explore, Discovery, UX]
audiences: [TENANT]
published_at: "2026-03-01"
---

## What changed
- Explore feed composition now returns two truthful sections: `Market picks` first, then `More to explore` when local market supply is low.
- Added a minimum target feed size strategy so lower-supply markets can be topped up with clearly labelled fallback listings where available.
- Added a section header in the Explore experience and fixed progress totals to follow the visible (post-hide) feed count.

## Why
- Some markets were seeing short feeds that felt inconsistent. This keeps feed continuity without mislabelling fallback inventory as local market picks.
