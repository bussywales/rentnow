---
title: "Explore V2 premium micro-actions: save, share, and quick CTA sheet"
areas: [Explore, Mobile]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Added a compact action rail to Explore V2 cards for `Save`, `Share`, and a context-aware CTA (`Book` or `Request viewing`).
- Added a lightweight CTA bottom sheet that shows listing summary details and a single `Continue` action into the existing detail/booking flow.
- Kept native feed scrolling and carousel swiping unchanged while adding these controls.

## Rollback plan
- Use the existing admin Explore feature toggle (`explore_enabled`) to reduce Explore exposure while rollback is in progress.
- Revert commit `feat(explore-v2): add premium micro-actions rail and CTA micro-sheet` if regressions are observed.
