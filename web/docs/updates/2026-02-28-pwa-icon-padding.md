---
title: "PWA icon padding is now centered for iOS"
audiences:
  - TENANT
areas:
  - Tenant
  - PWA
  - UX
summary: "Updated app icon assets with safe padding so the PH mark appears centered on iOS home-screen installs and across manifest icon variants."
published_at: "2026-02-28"
---

## What changed

- Added a new padded icon set sourced from a centered 1024 base mark and exported 512, 192, and maskable variants.
- Updated manifest icon paths to the padded assets and included an explicit 1024 icon entry.
- Updated Apple touch icon metadata to use the refreshed padded asset.
- Updated Admin PWA diagnostics icon links to reflect the new icon paths.

## Why this helps

- iOS home-screen icons now render with balanced visual padding instead of feeling top/edge-heavy.
- PWA icon appearance is more consistent across iOS and Android install surfaces.
