---
title: "Explore premium loading placeholders (v0.5)"
summary: "Premium placeholders for Explore galleries on slow connections."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Added premium placeholder metadata support for Explore images with safe fallbacks: dominant colour, BlurHash-seeded preview, and neutral fallback tones.
- Upgraded Explore gallery/carousel loading states so each image uses a richer placeholder layer while media loads.
- Kept placeholders visible for deferred/windowed slides, preventing white flashes when users swipe quickly on weak networks.

## Why
- On slower mobile connections, placeholder quality directly affects perceived performance and trust.
- This update keeps Explore interactions smooth while preserving a premium visual experience before full image bytes arrive.
