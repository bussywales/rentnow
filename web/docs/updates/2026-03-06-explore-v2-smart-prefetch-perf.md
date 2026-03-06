---
title: "Explore V2 smart prefetch now warms the next card more efficiently"
areas: [Explore-V2, Performance, Media]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Updated Explore V2 image warming to prefetch only the next card hero image instead of multiple upcoming cards.
- Kept network-aware guardrails in place so prefetching is automatically disabled on Save-Data and 2G/slow-2G connections.
- Reduced feed churn by using stable list keys and memoized viewport config, helping visual smoothness during scroll.
- Switched hero prefetching to lightweight cache warming (`Image().src`) instead of eager decode work, keeping CPU overhead lower while browsing.

## Rollback plan
- Revert commit `perf(explore-v2): smart hero prefetch and flicker reduction`.
- If urgent, disable Explore V2 prefetch via `NEXT_PUBLIC_EXPLORE_V2_PREFETCH_ENABLED=false`.
