---
title: "SafeImage migration for remaining home/explore/admin image surfaces"
areas: [Media, Reliability, Home, Explore, Admin]
audiences: [TENANT, ADMIN]
published_at: "2026-03-06"
---

## What changed
- Replaced direct `next/image` usage with `SafeImage` on the remaining guarded surfaces in Home, Explore details, and Admin panels.
- Preserved existing layout wrappers and sizing so image cards/sheets keep the same dimensions.
- Kept admin image failure fallbacks and error handling while routing Supabase-hosted assets through the safe loader path.

## Why this helps
- Reduces blank-image incidents caused by optimiser proxy failures on Supabase URLs.
- Aligns these surfaces with the same reliability model already used in other high-traffic listing views.

## Rollback plan
- Revert commit `fix(media): migrate remaining next/image offenders to SafeImage`.
