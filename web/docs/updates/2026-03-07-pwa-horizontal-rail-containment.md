---
title: "Contained horizontal snap rails to prevent page-level pan"
audiences: [TENANT]
areas: [PWA, UI, HOME]
published_at: "2026-03-07"
---

## What changed
- Added a shared `HorizontalSnapRail` wrapper that enforces horizontal containment (`max-w-full` + clipped outer wrapper) while keeping internal rail scrolling.
- Migrated tenant-facing fixed-width snap rails on home/discovery surfaces (and saved suggestions + shortlets map strip) to the shared wrapper.
- Added regression coverage to check document horizontal overflow before opening dock Search and after closing it.

## Why
- Prevents horizontal rails from expanding document width and causing persistent left/right page panning in iOS Safari/PWA flows.

## How to verify
- Open `/` on mobile Safari/PWA.
- Confirm horizontal rails still scroll inside their containers.
- Open and close dock Search.
- Confirm the page itself cannot be panned left/right.

## Rollback plan
- Revert commit `fix(pwa): contain horizontal rails with shared snap rail wrapper`.
