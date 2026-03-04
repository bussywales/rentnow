---
title: "Explore V2 quiet overlay mode for calmer image focus"
areas: [Explore V2, UI, Polish]
audiences: [TENANT]
published_at: "2026-03-04"
---

## What changed
- Added a subtle quiet mode to Explore V2 hero overlays so Save/Share/CTA controls stay visible but less dominant by default.
- Overlay controls now briefly brighten after hero interaction, then return to the calmer state automatically.
- This polish is opacity-only, so scroll/swipe behavior and layout remain unchanged.

## Rollback plan
- Revert commit `feat(explore-v2): add quiet overlay mode for premium focus` if regressions are found.
- If urgent, disable Explore via the existing kill switch while rollback deploys.
