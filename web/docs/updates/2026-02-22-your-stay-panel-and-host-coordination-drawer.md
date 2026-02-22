---
title: "Your stay panel and host coordination drawer polish"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Trips
  - Host
cta_href: "/trips"
published_at: "2026-02-22"
---

## What changed

- Trip detail now uses a single **Your stay** panel when payment is confirmed for pending/confirmed stays, combining check-in details, house rules, and coordination actions.
- The panel now pins the latest host note at the top and uses a clearer waiting state when details are still pending.
- Host bookings drawer now includes a **Check-in details status** readout (`sent` / `not sent` / `not configured`) next to guest notes.
- Hosts can still send check-in details from the drawer, and once sent the action is treated as one-time (idempotent route + disabled follow-up action).

## Why this matters

- Tenants get one calm, reliable place for post-booking stay information.
- Hosts get immediate visibility into coordination readiness before check-in.
- Reduced confusion around whether check-in details have already been shared.
