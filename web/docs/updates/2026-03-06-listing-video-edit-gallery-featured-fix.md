---
title: "Listing video persistence and unified media gallery fixes"
areas: [Listings, Media, Dashboard]
audiences: [HOST, AGENT, ADMIN, TENANT]
published_at: "2026-03-06"
---

## What changed
- Fixed listing edit hydration so attached listing videos are recovered more reliably for authorised host and delegated-agent sessions.
- Unified media management in the Photos step by adding a pinned `Video tour` tile into the same gallery grid as photos.
- Kept photo galleries visible when `featured_media` is set to video, so video affects only hero media and never removes photo browsing.
- Added safer signed-video URL metadata handling for edit surfaces so existing videos can be reloaded without requiring a fresh upload.

## Rollback plan
- Revert commit `fix(media): persist listing video and integrate into gallery`.
- If urgent, set affected listings back to `featured_media = image` until rollback is deployed.
