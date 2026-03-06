---
title: "Explore V2 now reveals full truncated listing titles"
areas: [Explore-V2, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Added a premium glass tooltip for Explore V2 card titles so the full listing name can be revealed when truncation occurs.
- Desktop users can reveal full titles on hover/focus, while mobile users can use long-press on truncated titles.
- Tooltip activation is gated by actual truncation detection to avoid unnecessary overlays.

## Rollback plan
- Revert commit `feat(explore-v2): reveal full truncated titles with glass tooltip`.
- If urgent, remove the tooltip wiring in `ExploreV2Card` and keep plain truncated titles.
