---
title: "Explore swipe recovery fix on iOS WebKit"
summary: "Fixed an iOS WebKit regression where vertical listing swipes could stop after a horizontal image swipe by hard-resetting pager gestures globally and removing sticky carousel touch-action locking."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Added a hard reset path in `ExplorePagerV2` that clears gesture state from global end/cancel listeners.
- Kept vertical release snapping intact while forcing non-vertical and stale gesture states back to a clean baseline.
- Stabilized Explore gallery touch handling by removing dynamic touch-action toggling that could leave horizontal mode sticky on iOS.

## Why
- Some iOS Safari/Firefox/A2HS sessions could leave Explore in a stale post-horizontal gesture state, making vertical listing swipes unreliable.
