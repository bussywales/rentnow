---
title: "Carousel swipe transition stability improvements"
areas: [Explore-V2, UI, Media]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Updated carousel swipe rendering so outgoing and incoming slides stay mounted while dragging.
- Removed mid-gesture blank gaps caused by early slide window unmounting.
- Preserved existing iOS vertical scroll compatibility and image decode/placeholder reveal gating.

## Rollback plan
- Revert commit `fix(ui): keep outgoing slide visible during swipe`.
- If urgent, temporarily disable motion-specific retention by reverting only the `UnifiedImageCarousel` drag-retention changes.
