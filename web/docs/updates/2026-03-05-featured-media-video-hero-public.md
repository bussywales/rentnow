---
title: "Featured media toggle and public listing video hero"
areas: [Listings, Media, Properties]
audiences: [TENANT, HOST, ADMIN]
published_at: "2026-03-05"
---

## What changed
- Added a per-listing `featured_media` setting so hosts can choose whether listing hero media is an image or video.
- Added a public-safe signed URL path for listing videos on publicly viewable property detail pages, without opening `property_videos` table RLS.
- Property detail now shows a video hero (poster-first, tap-to-play) when `featured_media` is set to video and a video is available.
- Listing cards and Explore surfaces keep image-first rendering and now show a small video badge when featured media is video.

## Rollback plan
- Revert commit `feat(media): public listing video hero + featured media toggle`.
- If needed, set affected listings back to `featured_media = image` so hero rendering falls back to image galleries immediately.
