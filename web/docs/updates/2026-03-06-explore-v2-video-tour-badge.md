---
title: "Explore V2: video tour badge on listings with video"
areas: [Explore-V2, Media, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Explore V2 cards now surface a subtle glass **Video tour** badge only when a listing has video.
- The feed uses a lightweight video signal for cards and keeps the hero carousel image-only for scrolling performance.
- Tapping the badge routes to listing detail with a video media hint (`media=video`).

## Rollback plan
- Revert commit `feat(explore-v2): show video tour badge on listings with video`.
