---
title: "Admins can trigger FX rates fetch instantly from System Health"
audiences:
  - ADMIN
areas:
  - Admin
  - FX
summary: "Added an admin-only 'Fetch FX rates now' action that securely triggers the internal FX daily fetch job without exposing cron secrets to browsers."
published_at: "2026-02-25"
---

## What changed

- Added a new admin-only API proxy at `/api/admin/fx/fetch-now`.
- The proxy securely triggers `/api/internal/fx/fetch-daily` server-to-server with `x-cron-secret`.
- Added a one-click action to `/admin/system`:
  - **Fetch FX rates now**
  - shows loading and success/error feedback
  - shows last fetched timestamp after success

## Why this helps

- Ops can refresh FX rates immediately when needed.
- No cron secret is exposed in client-side code.
