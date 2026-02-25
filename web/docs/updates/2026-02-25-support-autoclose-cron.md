---
title: "Support tickets now auto-close on stale resolved/new windows"
audiences:
  - ADMIN
areas:
  - Support
  - Operations
cta_href: "/admin/support"
published_at: "2026-02-25"
---

## What changed

- Added an internal support auto-close routine at `/api/internal/support/autoclose`.
- Added `closed` support status handling across admin support APIs and inbox filters/actions.
- Auto-close policy defaults:
  - `resolved` tickets close after 7 days
  - `new` tickets close after 30 days
- Added daily GitHub Actions schedule at `03:00 UTC`:
  - workflow: `.github/workflows/support-autoclose.yml`
  - endpoint call secured by `x-cron-secret` using `CRON_SECRET`.

## Why it matters

- Keeps `/admin/support` focused on active queue items.
- Reduces manual cleanup overhead for stale tickets.
- Runs as an idempotent cron-safe routine with response-count logging.
