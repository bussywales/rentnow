---
title: "Explore V2 conversion sheet now shows clearer pricing context before CTA"
areas: [Explore-V2, Conversion, Pricing, UI]
audiences: [TENANT]
published_at: "2026-03-07"
---

## What changed
- Added a dedicated price-clarity row in the Explore V2 conversion micro-sheet.
- Pricing now shows:
  - `From X / night` for shortlets
  - `From X / month` (or `/ year` when listing cadence is yearly) for rent
  - `From X` for buy
- Added an optional fee note only when known fee data exists, with no inferred totals or hidden fee assumptions.

## Rollback plan
- Revert commit `feat(explore-v2): add price clarity to conversion micro-sheet`.
- This restores the prior single-line price display in the micro-sheet.
