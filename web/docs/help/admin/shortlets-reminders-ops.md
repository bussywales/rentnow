---
title: "Admin shortlets: reminder operations"
description: "Operate shortlet reminder jobs safely and verify idempotent sends."
order: 39
updated_at: "2026-02-22"
---

## Internal reminder route

Cron target:

- `POST /api/internal/shortlet/send-reminders`
- Required header: `x-cron-secret: <CRON_SECRET>`

## What the job does

- Selects eligible paid bookings in active reminder windows.
- Sends in-app and email reminders for key check-in and checkout moments.
- Uses `shortlet_reminder_events` for idempotency (`booking_id + event_key`).

## Runbook checks

- Confirm route responses include `ok: true`.
- Confirm `skippedAlreadySent` rises on retries (expected).
- Confirm no booking/payment statuses are mutated by this job.

## Troubleshooting

- `403 Forbidden`: missing/invalid cron secret.
- `503 Service role not configured`: service key not available.
- Empty sends with non-empty bookings: verify payment status is succeeded.

## Roadmap TODO (not in this release)

- Tap-to-zoom images
- Smart lock integrations
- Calendar export (ICS) for hosts
