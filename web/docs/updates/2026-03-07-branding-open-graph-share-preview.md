---
title: "Added premium Open Graph and Twitter share previews"
audiences: [TENANT, HOST, ADMIN]
areas: [BRANDING, SEO, SOCIAL]
published_at: "2026-03-07"
---

## What changed
- Added a new default social preview image at `/og-default.png` (1200x630) with the PropatyHub mark and tagline.
- Updated global App Router metadata defaults to include premium Open Graph and Twitter cards:
  - Title uses: `PropatyHub — Rent • Buy • Shortlets`
  - Large image cards use `/og-default.png`
- Kept page-level metadata overrides intact while improving fallback preview quality on dynamic share routes.

## Why
- Shared links now have a consistent, premium preview across platforms and routes.
- Explicit defaults reduce broken or low-quality social previews when page-specific imagery is unavailable.

## Rollback plan
- Revert commit `feat(branding): add open graph share preview metadata`.
