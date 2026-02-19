---
title: "Additive property image optimisation pipeline on Supabase Storage"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - Listings
  - Media
  - Storage
cta_href: "/dashboard/properties/new"
published_at: "2026-02-19"
---

## What changed

- Added an additive image pipeline that keeps originals and generates WebP derivatives (`thumb`, `card`, `hero`) for property photos.
- Originals are stored under `property-images/properties/{propertyId}/{imageId}/original.<ext>` and derivative storage paths are persisted in `property_images`.
- Added a feature flag `IMAGE_OPTIMISATION_ENABLED` for safe rollout; set `NEXT_PUBLIC_IMAGE_OPTIMISATION_ENABLED=true` to enable client-side handoff to the optimisation endpoint. When disabled, uploads keep the previous behaviour.

## Quality thresholds

- Uploads up to 20MB are accepted and pre-compressed client-side for slower networks.
- Images under 600px width are rejected as too low-resolution.
- Images between 600px and 1199px width are accepted with a low-resolution warning.

## Compatibility

- Existing image URLs and listing pages continue to work.
- UI now prefers derivative URLs when available, then falls back to legacy `image_url`, then placeholder images.
