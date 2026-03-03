---
title: "Explore stabilisation kill-switch and labs pager"
areas: [Explore, Home, Admin]
audiences: [TENANT, HOST, ADMIN]
published_at: "2026-03-03"
---

## What changed
- Added an admin kill-switch (`explore_enabled`) so Explore can be disabled quickly from Admin Settings.
- When disabled, Home hides the Explore quick-start chip and `/explore` shows a temporary unavailable screen.
- Added `/explore-labs` with a minimal `PagerLite` transform-based vertical pager that keeps the existing Explore slide/gallery UI.

## Why
- This gives operations a safe fallback while Explore gesture and rendering work continues.
- Labs route provides a low-risk reference pager for stability testing without deleting or replacing the main Explore implementation.
