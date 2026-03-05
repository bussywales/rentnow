---
title: "Hardened admin inspector image rendering with safe loader fallback"
areas: [Admin, Listings, Media]
audiences: [ADMIN]
published_at: "2026-03-05"
---

## What changed
- Updated `/admin/listings/[id]` media rendering to bypass Next image optimization for Supabase-hosted media URLs.
- Added resilient fallback states in the inspector media tiles so failed loads show an admin-safe recovery action instead of blank boxes.
- Kept cover and gallery layout sizing stable to avoid empty visual tiles when image requests fail.

## Rollback plan
- Revert commit `fix(admin): render inspector images with safe loader`.
