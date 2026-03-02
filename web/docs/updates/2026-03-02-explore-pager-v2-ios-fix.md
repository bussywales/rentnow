---
title: "Explore now uses a TikTok-style pager on iOS for reliable swiping"
summary: "Replaced Explore's vertical scroll-snap paging with a deterministic transform-based pager so horizontal image swipes never break vertical listing swipes on iOS Safari and installed web apps."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Rebuilt Explore vertical paging with a transform-driven pager instead of native scroll-snap.
- Added explicit gesture axis detection so horizontal image swipes are handed off to the gallery while vertical swipes always page listings.
- Added robust reset paths (`touchend`, `touchcancel`, `pointerup`, `pointercancel`, blur, visibility changes, and cleanup) plus a safety timeout fallback.

## Why
- On iOS WebKit (Safari, Firefox iOS, and A2HS), native scroll-snap and horizontal gestures could conflict, causing vertical paging to get stuck after image swipes.
