---
title: "Property detail: always show Video tour section when video exists"
areas: [Properties, Media, UI]
audiences: [TENANT, HOST]
published_at: "2026-03-06"
---

## What changed
- Property detail now shows a **Video tour** chip whenever a listing has video, even when `featured_media` remains image.
- Listings with video now render a dedicated **Video tour** section below the hero/gallery when hero remains image-first.
- `featured_media` now controls hero mode only (video hero vs image hero); it no longer controls overall video discoverability.

## Rollback plan
- Revert commit `feat(media): show video tour section even when not featured`.
