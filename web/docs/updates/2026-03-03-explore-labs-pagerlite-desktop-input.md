---
title: "Explore Labs PagerLite desktop swipe input support"
areas: [Explore]
audiences: [TENANT, HOST, AGENT, ADMIN]
published_at: "2026-03-03"
---

## What changed
- Added desktop wheel/trackpad vertical paging support to `/explore-labs` `PagerLite` with delta thresholding and cooldown to avoid accidental double-advances.
- Added desktop mouse drag fallback for vertical paging with strict gallery-start exclusion so horizontal gallery interactions stay isolated.
- Extended Explore Labs smoke coverage to verify desktop wheel advances slides without runtime errors.

## Why
- Desktop users (especially trackpad users) can now page listings vertically in Labs with the same reliability expected on touch devices.
- The guardrails prevent vertical paging from hijacking horizontal image-gallery gestures.
