---
title: "Explore now uses full photo sets with more reliable swiping"
summary: "Listings with multiple photos now use their full image arrays in Explore, and horizontal swipe is only enabled when more than one image exists."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Explore now composes gallery images from both `images` and `property_images` relations, with deterministic ordering and dedupe.
- Horizontal swipe behavior is enabled only when a listing has more than one image.
- Single-image listings no longer present fake swipe behavior that snaps back.

## Why
- Some Explore cards were effectively operating on a single cover image even when extra images existed.
- This created inconsistent swipe behavior on mobile Safari and made image progression feel broken.
