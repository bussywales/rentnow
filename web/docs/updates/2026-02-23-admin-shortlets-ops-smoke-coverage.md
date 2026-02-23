---
title: "Admin shortlets ops smoke coverage"
audiences:
  - ADMIN
areas:
  - QA
  - SHORTLETS
cta_href: "/admin/shortlets/ops"
published_at: "2026-02-23"
---

## What changed

- Added Playwright smoke coverage for admin shortlets operations.
- The smoke flow now validates admin login, `/admin/shortlets/ops` page render, and refresh-driven stats refetch.
- CI smoke workflow now passes admin credential env vars so the spec can run when secrets are configured.

## Why this matters

- Prevents regressions on the admin ops surface used for shortlets go-live checks.
- Keeps the smoke suite safe by skipping cleanly when admin credentials are unavailable.
