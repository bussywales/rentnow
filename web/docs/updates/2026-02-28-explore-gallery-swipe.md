---
title: "Explore gallery now supports direct image swiping"
summary: "Users can swipe left/right through listing photos in Explore without opening details, while vertical listing swipes remain stable."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-02-28"
---

## What changed
- Enabled reliable left/right swiping through listing images directly on `/explore` slides.
- Preserved vertical swipe-to-next-listing behavior with gesture locking.
- Kept existing image fallback and optimiser-bypass reliability hardening.

## Why
- Touch handling favored vertical gestures on iOS Safari, making horizontal gallery swipes unreliable.
- This update prioritizes horizontal gallery intent while keeping vertical discovery smooth.
