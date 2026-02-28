---
title: "Explore shows stronger listings first (image quality control)"
audiences:
  - TENANT
areas:
  - Tenant
  - Explore
  - Discovery
  - Trust
summary: "Explore now filters out listings without usable images and prioritises listings with fuller photo galleries, while keeping deterministic fallback behaviour."
published_at: "2026-02-28"
---

## What changed

- Explore feed now applies an image-quality pass before rendering:
  - Listings with zero usable images are filtered out by default.
  - Listings with richer image galleries are shown first.
  - One-image listings are still allowed as a fallback when needed.
- Ordering remains deterministic to avoid feed flicker.

## Why this helps

- Reduces broken or low-confidence first impressions in Explore.
- Keeps feed quality high without deleting or mutating listing data.
