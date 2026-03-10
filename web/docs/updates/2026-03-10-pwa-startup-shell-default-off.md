---
title: "Startup shell now defaults off for cleaner first paint"
audiences: [TENANT, HOST, ADMIN]
areas: [pwa, performance, branding]
published_at: "2026-03-10"
---

## What changed
- Changed the startup shell gate so the branded startup shell is disabled by default.
- The shell now renders only when `NEXT_PUBLIC_SPLASH_SHELL_DISABLED=false` is explicitly set.
- Kept the shell implementation in place for controlled future experiments.

## Why
- On cold starts the shell was appearing late and looked like an error flash.
- Defaulting to the existing first-paint background path gives a cleaner startup experience.

## How to verify
- Load the app without setting `NEXT_PUBLIC_SPLASH_SHELL_DISABLED`; confirm no startup shell markup renders.
- Set `NEXT_PUBLIC_SPLASH_SHELL_DISABLED=false`; confirm startup shell renders again.

## Rollback
- Revert commit `chore(pwa): disable startup shell by default`.
- Or set `NEXT_PUBLIC_SPLASH_SHELL_DISABLED=false` in production to re-enable without code rollback.
