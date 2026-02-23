---
title: "Shortlets ops console for go-live readiness"
audiences:
  - ADMIN
  - HOST
areas:
  - Shortlets
  - Operations
cta_href: "/admin/shortlets/ops"
published_at: "2026-02-23"
---

## What changed

- Added an admin-only **Shortlets Ops** console at `/admin/shortlets/ops` with a calm, refreshable readiness snapshot.
- Added a new admin API endpoint `/api/admin/shortlets/ops` that aggregates:
  - reminders run health (last run/success/failure + recent summaries),
  - payout request queue health,
  - approvals SLA risk (due soon + overdue),
  - payment/booking mismatches (`payment=succeeded` while booking remains `pending_payment`).
- Added reminders job-run persistence via `shortlet_job_runs` so reminder runs are queryable beyond logs.

## Who it affects

- Admin:
  - Can verify shortlets go-live health in one place without scanning multiple endpoints/log streams.
- Host:
  - Indirectly benefits from faster ops detection on reminders, approvals backlog, and payout queue readiness.

## Where to find it

- `/admin/shortlets/ops`
- `/api/admin/shortlets/ops`
- `/api/internal/shortlet/send-reminders`
