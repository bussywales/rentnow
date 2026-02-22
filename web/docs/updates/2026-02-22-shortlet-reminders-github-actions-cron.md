---
title: "Shortlet reminders now run on a GitHub Actions 15-minute schedule"
audiences:
  - HOST
  - ADMIN
areas:
  - Shortlets
  - Operations
published_at: "2026-02-22"
---

## What changed

- Added a GitHub Actions scheduled workflow that calls `/api/internal/shortlet/send-reminders` every 15 minutes.
- Added a workflow contract unit test to lock cadence, endpoint, secret header usage, and concurrency settings.
- Added retry/failure artifact capture in the workflow so failed reminder runs are easier to diagnose.

## Why this matters

- Reminder dispatch continues on Vercel Hobby without relying on Vercel Cron.
- Scheduling and secret wiring are now test-guarded to prevent silent regressions.
- Ops can manually trigger runs from GitHub Actions when needed.
