---
title: "Added branded PWA startup shell for cold starts"
audiences: [TENANT, HOST, ADMIN]
areas: [pwa, branding, performance]
published_at: "2026-03-09"
---

## What changed
- Added an SSR startup shell at app boot (`#app-startup-shell`) so cold starts show a branded first paint immediately.
- The shell uses a light branded background (`#f8fafc`) aligned to manifest `background_color` and centers the PropatyHub app icon.
- Added a tiny client remover that fades the shell out and removes it as soon as hydration completes.
- Added a kill switch: `NEXT_PUBLIC_SPLASH_SHELL_DISABLED=true` skips shell render/removal.

## Why
- Eliminates blank/flash launch states on iPhone Safari and installed PWA cold starts when React hydration is delayed.
- Improves launch perception without blocking app boot or adding heavy startup work.

## How to verify
- Launch the app from a cold start on iOS Safari/PWA and confirm the branded shell appears immediately.
- Confirm the shell fades away quickly once the app becomes interactive.
- Set `NEXT_PUBLIC_SPLASH_SHELL_DISABLED=true` and confirm the shell is not rendered.

## Rollback plan
- Revert commit `feat(pwa): add branded startup shell for cold starts`.

