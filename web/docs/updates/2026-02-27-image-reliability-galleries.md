---
title: "Gallery images load more reliably on mobile"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - UX
summary: "Explore and property galleries now bypass the Next optimizer for Supabase-hosted images to avoid intermittent 402 image failures, while keeping local fallbacks for broken assets."
published_at: "2026-02-27"
---

## What changed

- Updated gallery rendering so Supabase-hosted image URLs are loaded directly instead of routing through `/_next/image`.
- Kept existing fallback behavior (`/og-propatyhub.png`) when an image fails to load.
- Preserved performance safeguards already in Explore gallery (windowed rendering + adjacent preloading).

## Why this helps

- Prevents broken-image states caused by `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` failures from the Next optimizer.
- Improves reliability on Safari/mobile where gallery failures were most visible.
