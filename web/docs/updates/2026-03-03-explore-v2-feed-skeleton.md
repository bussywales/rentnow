---
title: "Explore V2 feed skeleton with native virtualised scrolling"
areas: [Explore]
audiences: [TENANT, HOST, AGENT, ADMIN]
published_at: "2026-03-03"
---

## What changed
- Added an experimental `/explore-v2` route with an Instagram-style vertical feed skeleton.
- The feed now uses native browser scrolling with `react-virtuoso` virtualisation for smoother performance on mobile.
- Added layout-stable card placeholders and reserved media boxes to avoid layout shift while browsing.

## Why
- This creates a stable baseline for Explore V2 on iOS Safari, iOS PWA, and Firefox mobile without pager gesture conflicts.
- It keeps rendering smooth under longer feeds before image carousel integration in later iterations.
