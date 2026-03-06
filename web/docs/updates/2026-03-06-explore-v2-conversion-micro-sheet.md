---
title: "Explore V2 now opens a faster conversion micro-sheet for booking and viewing actions"
areas: [Explore-V2, Conversion, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Updated Explore V2 card primary CTA to open a lightweight quick-action sheet instead of navigating immediately.
- Added a richer summary block in the sheet (thumbnail, title, location, price, and listing badges).
- Added secondary actions in the sheet: `View details`, `Save`, and `Share`, while keeping the existing booking/viewing destination flows unchanged.

## Rollback plan
- Revert commit `feat(explore-v2): add conversion micro-sheet for primary CTA`.
- Fallback behaviour returns to direct CTA navigation from card.
