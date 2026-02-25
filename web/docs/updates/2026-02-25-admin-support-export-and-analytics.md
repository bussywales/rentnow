---
title: "Admin support inbox now includes CSV export and queue analytics"
audiences:
  - ADMIN
areas:
  - Support
  - Operations
cta_href: "/admin/support"
published_at: "2026-02-25"
---

## What changed

- Added admin-only CSV export endpoint at `/api/admin/support/requests/export.csv`.
- Export supports request filters:
  - `status` (`open|all|new|in_progress|resolved|closed`)
  - `escalated=1`
  - `date_from` / `date_to` (or `from` / `to`) for created-at range filtering
- Added support inbox analytics cards in `/admin/support`:
  - New (7d)
  - In progress
  - Resolved (7d)
  - Overdue
- Added an `Export CSV` action in the support inbox toolbar.

## Why it matters

- Admins can export support volume quickly for reporting without manual copy/paste.
- The inbox now gives immediate queue health signals for triage and workload planning.
