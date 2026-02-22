---
title: "Admin shortlet reminders ops readout and run summary hardening"
audiences:
  - ADMIN
  - HOST
areas:
  - Shortlets
  - Operations
cta_href: "/admin/shortlets"
published_at: "2026-02-22"
---

## What changed

- Added a secured admin endpoint at `/api/admin/shortlets/reminders/stats` with `sentToday`, `failedToday`, and `nextRunAt` readout fields.
- Hardened the internal reminders worker response payload to always include explicit count fields: `sent`, `skipped`, and `errorsCount`.
- Added structured run summary logging for reminders dispatch runs to improve cron observability.

## Why this matters

- Admin and ops can quickly verify reminder throughput without manually scanning every booking event.
- Scheduled runs now fail fast if the endpoint response is malformed or not `ok: true`, reducing silent cron failures.
