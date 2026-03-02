---
title: "Explore on iOS now always restores vertical paging after image swipes"
summary: "Fixed an iOS WebKit interaction bug where Explore could get stuck in horizontal mode after swiping listing images, preventing vertical paging between listings."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Hardened Explore gesture lock reset logic so vertical pager controls always restore after horizontal image interactions.
- Added fallback reset paths for iOS edge cases (`touchcancel`, `pointercancel`, app blur, and tab visibility changes).
- Added a short safety timeout to force lock release if iOS drops end events during momentum/gesture transitions.

## Why
- Some iOS Safari/A2HS sessions could remain stuck in horizontal gesture mode after swiping listing images once, blocking vertical paging through listings.
