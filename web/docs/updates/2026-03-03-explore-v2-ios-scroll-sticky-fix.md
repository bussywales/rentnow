---
title: "Explore V2 iOS carousel no longer sticks vertical scroll"
areas: [Explore, Mobile, iOS]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Fixed an iOS Safari/PWA issue where vertical page scrolling could feel stuck after swiping listing images horizontally in Explore V2.
- Updated the Explore carousel viewport and track touch policy to always allow vertical pan and pinch-zoom in the image area.
- Updated carousel overflow policy to use `overflow-hidden` so native horizontal scroller behavior does not interfere with vertical page scroll.

## Rollback plan
- Revert commit `fix(explore-v2): prevent carousel gestures blocking vertical scroll on iOS` if regressions appear.
- If urgent, disable Explore via the existing kill switch while rollback is prepared.
