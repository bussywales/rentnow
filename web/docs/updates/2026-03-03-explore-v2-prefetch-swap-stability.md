---
title: "Explore V2 smoother image loading on slow mobile data"
areas: [Explore, Mobile]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Explore V2 now prefetches only the next 1-2 hero images ahead of the visible card window to reduce perceived loading gaps while scrolling.
- Prefetching is guarded by network and device hints:
  - Disabled when Save-Data is on.
  - Disabled on `slow-2g` and `2g`.
  - Reduced on low-memory devices.
  - Bounded by a capped session prefetch window.
- Carousel image reveal now waits for decode readiness and a short minimum placeholder hold so image swaps feel steadier with less flicker.

## Rollback plan
- Immediate config rollback: set `NEXT_PUBLIC_EXPLORE_V2_PREFETCH_ENABLED=false` and redeploy to disable Explore V2 prefetching.
- Code rollback: revert commit `perf(explore-v2): prefetch next heroes and stabilize decode swap` if regressions persist.
