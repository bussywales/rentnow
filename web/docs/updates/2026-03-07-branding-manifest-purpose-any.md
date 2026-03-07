---
title: "Made PWA manifest icon purposes explicit and locked icon masters for reproducible branding builds"
audiences: [TENANT, HOST, ADMIN]
areas: [PWA, BRANDING]
published_at: "2026-03-07"
---

## What changed
- Updated PWA manifest icon entries so standard launcher icons explicitly use `purpose: "any"`.
- Kept adaptive entries explicit with `purpose: "maskable"` for Android maskable icon support.
- Confirmed and tracked both 2048x2048 icon master PNGs in `web/assets/brand` so icon generation is reproducible.

## Why
- Explicit `purpose` values improve launcher icon selection correctness across platforms.
- Tracking masters in git keeps icon generation deterministic for local and CI builds.

## Rollback plan
- Revert commit `chore(branding): make manifest icon purposes explicit and track masters`.
