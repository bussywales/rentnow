---
title: "Landlord shortlets: agenda and reminder operations"
description: "Use host calendar agenda and reminder tooling to reduce check-in misses."
order: 39
updated_at: "2026-02-22"
---

## Host agenda on calendar

Open `/host/calendar` to view **Check-in agenda** buckets:

- Today
- Tomorrow
- Next 7 days

Each agenda item links to the booking inbox so you can review requests or confirmed stays quickly.

## Reminder automation

The platform sends reminder events for paid shortlet bookings at:

- 48h before check-in
- 24h before check-in
- 3h before check-in
- checkout morning

24h reminders include a host heads-up.

## Manual send action

From booking details in `/host/bookings`, use **Send check-in details now** for confirmed paid stays.

- This action is idempotent (cannot be spammed repeatedly).
- Guest receives in-app notification plus email when available.

## Related links

- [Host bookings](/host/bookings)
- [Host calendar](/host/calendar)
