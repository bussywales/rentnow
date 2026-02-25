---
title: "Mobile home: Market-aware featured discovery"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - Home
summary: "Mobile featured discovery now adapts to the selected market with deterministic, fair rotation and safe global fallback."
published_at: "2026-02-25"
---

## What changed

- Replaced Nigeria-only featured cards with a static, market-aware catalogue (`NG`, `GB`, `CA`, `GLOBAL`).
- Added deterministic daily rotation per market so the strip stays fresh without random flake.
- Added strict fallback behaviour:
  - market cards first
  - global cards only when needed
  - safe empty behaviour if no valid catalogue entries exist.
- Kept routing static and existing-destination compatible (`/shortlets?...` and `/properties?...`).

## Why this helps

- Discovery feels locally relevant without biasing all users toward one market.
- Rotation is predictable and testable, so go-live smoke remains stable.
- Operations can update the static catalogue through repository changes without needing backend/admin UI work.
