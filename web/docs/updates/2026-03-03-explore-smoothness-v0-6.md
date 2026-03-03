---
title: "Explore v0.6 smoothness improvements"
areas: [Explore, Mobile, Performance]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Stabilized Explore image placeholders so the placeholder layer remains persistent behind images while the real image fades in.
- Reduced loading indicator flicker by debouncing the `Loading...` cue (show delay + minimum visible duration).
- Added adjacent-hero pre-decode on non-constrained connections to reduce decode stutter during vertical paging.

## Why
- On weak mobile data, some users saw brief blink/jank while paging between listings.
- These changes keep gestures responsive while making image transitions and loading feedback feel more continuous.
