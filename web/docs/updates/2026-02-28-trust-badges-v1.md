---
title: "Trust badges are clearer in Explore (truth-only)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - UX
summary: "Explore now shows subtle trust badges only when real listing signals exist, including verified, recently updated, and fast response cues."
published_at: "2026-02-28"
---

## What changed

- Added truth-only trust badge derivation for Explore listings:
  - `Verified` appears only when listing data includes explicit verification signals.
  - `Updated recently` appears only when a recent update timestamp exists.
  - `Fast response` appears only when a real response-time signal exists.
- Applied these badges to both:
  - Explore slide overlay
  - Explore details sheet
- Capped overlay trust badges to two to keep the UI clean and readable.

## Why this helps

- Trust cues are now clearer and more reliable.
- Users get useful confidence signals without extra clutter.
- No fake badges are shown when data is missing.
