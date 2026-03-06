---
title: "Explore V2 save/share glass feedback"
areas: [Explore-V2, UI, Saved, Share]
audiences: [TENANT]
published_at: "2026-03-05"
---

## What changed
- Added premium glass toast feedback in `/explore-v2` for save/share actions.
- Save now shows immediate micro-feedback (`Saved` / `Removed`) and a subtle icon pulse.
- Share now confirms outcomes with clear toast copy (`Shared`, `Link copied`, or `Copy failed`).
- Logged-out users now get a lightweight sign-in bottom sheet when trying to save, instead of a sudden redirect.

## Rollback plan
- Revert commit `feat(explore-v2): add glass toast feedback for save/share`.
