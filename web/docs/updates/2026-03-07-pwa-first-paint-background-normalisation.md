---
title: "Normalised first-paint background to remove launch blink"
audiences: [TENANT, HOST, ADMIN]
areas: [PWA, UI, PERFORMANCE]
published_at: "2026-03-07"
---

## What changed
- Added deterministic first-paint surface rules so both `html` and `body` start on the same light background as the app shell.
- Set `html` color scheme to light to avoid dark-mode prepaint mismatch before app UI renders.

## Why
- Reduces brief white/black blank flashes before the interface appears.
- Improves launch polish on mobile browsers and installed PWA surfaces.

## How to verify
- Hard-refresh the site or relaunch the installed PWA.
- Confirm there is no dark/blank blink before the page UI appears.
- Confirm existing in-app dark accent elements remain unchanged.

## Rollback plan
- Revert commit `chore(pwa): normalise first paint background to remove blink`.
