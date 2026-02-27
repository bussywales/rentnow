---
title: "Shortlets mobile stability improvements"
audiences:
  - TENANT
areas:
  - Shortlets
  - Mobile
  - Reliability
summary: "Improved shortlets mobile rendering stability and reduced transient runtime crashes during first load."
published_at: "2026-02-27"
---

## What changed

- Hardened shortlets mobile rendering to avoid intermittent client hydration mismatches on initial load.
- Kept runtime error guards strict in go-live tests and added targeted diagnostics to capture one-time failure breadcrumbs when needed.
- Added regression coverage to keep shortlets map/list interactions stable during mobile smoke runs.

## Why this helps

- Reduces occasional first-load rendering crashes on `/shortlets` mobile.
- Keeps shortlets browsing flow more reliable without changing core search behavior.
