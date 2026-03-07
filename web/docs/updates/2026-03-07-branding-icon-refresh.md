---
title: "Refreshed favicon and PWA icon set from new PropatyHub masters"
audiences: [TENANT, HOST, ADMIN]
areas: [branding, pwa]
published_at: "2026-03-07"
---

## What changed
- Generated and installed a new icon set from the 2048x2048 brand masters.
- Updated browser favicon assets (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`).
- Updated PWA icons for standard and maskable Android install surfaces.
- Updated `apple-touch-icon.png` for iOS home-screen installs.
- Wired manifest and diagnostics to the refreshed icon paths.

## How to verify
- Hard refresh the site and confirm the browser tab favicon updates.
- Open `/manifest.webmanifest` and confirm it lists `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, and `icon-512-maskable.png`.
- Reinstall the PWA on mobile to pick up the new install icon set.

## Rollback plan
- Revert commit `feat(branding): refresh favicon and pwa icons with new logo`.
