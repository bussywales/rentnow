---
title: "Image optimisation mode control added"
date: "2026-03-16"
summary: "Added an admin-only app setting to reduce or disable shared image optimisation when transform usage spikes."
audiences:
  - ADMIN
areas:
  - ops
  - images
  - performance
---

## What changed

- Added an admin-only app setting: `image_optimization_mode`.
- Routed the setting through the shared image rendering path used by `SafeImage`, `UnifiedImageCarousel`, and `PropertyGallery`.
- Added an admin settings control with three modes:
  - `vercel_default`
  - `disable_non_critical`
  - `disable_all`

## What each mode does

- `vercel_default`
  - Keeps the current `next/image` behaviour.
- `disable_non_critical`
  - Disables optimisation for shared non-critical image surfaces like rails, cards, and admin media panels.
  - Keeps shared critical gallery/carousel surfaces on the normal path unless they already bypass optimisation.
- `disable_all`
  - Disables optimisation across the shared image wrappers used for major listing/gallery surfaces.

## Rollback

- Switch `image_optimization_mode` back to `vercel_default`
- Or revert the commit if the control needs to be removed
