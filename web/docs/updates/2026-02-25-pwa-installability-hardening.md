---
title: "PWA installability hardened for Android and Samsung Internet"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - PWA
  - Mobile
summary: "Improved web-app install reliability by tightening manifest icons/start URL and root service-worker registration, with new admin diagnostics."
published_at: "2026-02-25"
---

## What changed

- Updated manifest install metadata with explicit root scope and a launch start URL for PWA entry.
- Added a 512x512 maskable icon for Android install surfaces.
- Hardened service-worker registration to always register `/sw.js` at scope `/` and avoid duplicate registration races.
- Made service-worker install caching more fault-tolerant so a single cache miss does not fail installation.
- Added an admin-only diagnostics block on `/admin/system` showing:
  - Manifest URL
  - start URL + scope
  - icon URLs
  - service-worker path/scope
  - quick DevTools verification steps

## Why this helps

- Reduces Android/Samsung install failures caused by incomplete manifest icon metadata or unstable service-worker registration.
- Gives ops a fast checklist to validate installability without digging through code.
