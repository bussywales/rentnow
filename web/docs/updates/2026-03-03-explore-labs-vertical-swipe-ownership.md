---
title: "Explore Labs vertical swipe ownership and iOS scroll containment"
areas: [Explore]
audiences: [TENANT, HOST, AGENT, ADMIN]
published_at: "2026-03-03"
---

## What changed
- Updated `PagerLite` gesture ownership so swipes that start in the gallery now use axis intent:
  - horizontal intent stays with the image carousel
  - vertical intent is handled by the pager
- Added stronger `/explore-labs` scroll containment to prevent iOS page drag takeover while preserving carousel behavior.
- Added regressions for vertical swipe from inside the gallery layer and desktop wheel paging.

## Why
- Vertical listing paging now works reliably even when the swipe starts directly on the image area.
- Horizontal image swipes remain isolated to the carousel without triggering accidental vertical paging.
