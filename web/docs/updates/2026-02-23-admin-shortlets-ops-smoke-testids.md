---
title: "Admin shortlets ops smoke test selectors hardening"
audiences:
  - ADMIN
areas:
  - Shortlets
  - Operations
cta_href: "/admin/shortlets/ops"
published_at: "2026-02-23"
---

## What changed

- Added stable `data-testid` attributes for the admin shortlets ops root, metrics grid, and refresh action.
- Added smoke E2E coverage for admin ops page render and refresh API call reliability.

## Who it affects

- Admin:
  - No visual UI change; this improves test stability and go-live confidence.

## Where to find it

- `/admin/shortlets/ops`
