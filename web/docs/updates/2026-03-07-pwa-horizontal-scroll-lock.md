---
title: "Locked horizontal scroll after dock search overlay close"
audiences: [TENANT]
areas: [PWA, UI, NAVIGATION]
published_at: "2026-03-07"
---

## What changed
- Added a baseline horizontal overflow guard on `html` and `body`.
- Updated GlassDock and dock search overlay roots to use fixed left/right insets instead of viewport-width-plus-padding patterns that can overflow on iOS Safari/PWA.
- Added regression coverage to assert no horizontal overflow remains after opening and closing dock search.

## Why
- Prevents persistent left/right page panning after closing the dock search overlay on iOS Safari/PWA.

## How to verify
- Open the site on mobile Safari or installed PWA.
- Open dock Search, then close it.
- Confirm the page cannot be panned left/right.

## Rollback plan
- Revert commit `fix(pwa): prevent persistent horizontal scroll after search overlay`.
