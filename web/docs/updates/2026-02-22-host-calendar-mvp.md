---
title: "Host calendar MVP for shortlet availability"
audiences:
  - HOST
  - AGENT
areas:
  - Host
  - Shortlets
  - Calendar
cta_href: "/host/calendar"
published_at: "2026-02-22"
---

## What changed

- Added a new host route at `/host/calendar` for shortlet availability management.
- The calendar shows booked dates as read-only and blocked dates as unavailable overlays.
- Hosts can select a date range to create new blocks and remove existing blocks inline.
- Added a direct `Calendar` entry point from `/host/bookings`.

## Why this matters

- Hosts now have a visual command centre for availability instead of managing only list rows.
- Reduces missed conflicts by making booked/blocked states obvious at a glance.
