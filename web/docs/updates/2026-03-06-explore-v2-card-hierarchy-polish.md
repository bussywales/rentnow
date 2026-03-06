---
title: "Explore V2 card hierarchy polished for cleaner browsing"
areas: [Explore-V2, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Refined Explore V2 card typography hierarchy so titles, locations, and prices read more consistently at a glance.
- Standardized title clamp behavior to two lines and location to one line for cleaner, predictable card rhythm.
- Improved overlay spacing so CTA and action controls stay clear of carousel dots, and added a subtle hero scrim for better contrast on bright photos.

## Rollback plan
- Revert commit `feat(explore-v2): polish card hierarchy and metadata layout`.
- If urgent, remove the updated hierarchy/scrim classes in `ExploreV2Card` and keep the prior card presentation.
