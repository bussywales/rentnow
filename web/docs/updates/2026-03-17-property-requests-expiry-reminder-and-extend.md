---
title: Property Requests expiry reminder and extend flow
date: 2026-03-17
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - requests
  - lifecycle
  - notifications
summary: Property Requests now send a 3-day expiry reminder email and let eligible owners extend an open request by another 30 days with a one-click flow.
---

## What changed

- Added a 3-day email reminder for open Property Requests that are approaching expiry.
- Added a one-click owner extend flow that adds another 30 days to an eligible request.
- Added a small manage-view extension affordance so owners can extend from the request page as well as from email.
- Added a daily cron workflow and internal endpoint for reminder dispatch.

## Reminder timing

- V1 sends one reminder roughly 3 days before request expiry.
- Closed, removed, and otherwise ineligible requests are excluded.
- Repeated reminders for the same expiry cycle are suppressed.

## Extend behaviour

- Extension keeps the default expiry policy intact and adds 30 days to the current expiry.
- The extend flow is owner-only.
- V1 limits repeated extensions with a small hard cap to avoid open-ended request loops.

## Rollback

- Revert the shipping commit.
- If needed, follow with a new migration rather than editing an applied migration.
