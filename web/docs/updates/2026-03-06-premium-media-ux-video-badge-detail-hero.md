---
title: "Premium media UX: Explore video badge and detail hero gallery continuity"
areas: [Explore-V2, Properties, Media, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Explore V2 cards now show a subtle glass **Video tour** badge when a listing has a video signal.
- Tapping the badge routes to the listing detail page with a media hint (`media=video`).
- Property detail keeps photo gallery continuity when featured media is video, and now includes a **Video tour** chip near the gallery header to jump back to the hero player.

## Rollback plan
- Revert commit `feat(media): add Explore video badge and keep gallery visible with featured video`.
- If urgent, remove the Explore V2 video badge and `PropertyMediaHero` video-tour chip while keeping existing hero/gallery behaviour.
