---
title: "Admin shortlets"
description: "Run shortlet booking ops, expiry jobs, and manual payout reconciliation."
order: 35
updated_at: "2026-02-14"
---

## Admin shortlet control surfaces

- `/admin/shortlets` for bookings review and filters.
- `/admin/shortlets/payouts` for manual payout queue.
- `/api/shortlet/bookings/expire-due` for pending expiry cron run.

## Booking lifecycle

- `pending` -> host action needed.
- `confirmed` -> payout candidate exists.
- `declined` / `expired` -> refund-needed marker may be set.
- `completed` -> payout is eligible.

## Manual payouts

Use payout queue actions:

1. Verify booking status and check-in date.
2. Mark payout paid with reference and note.
3. Confirm row moved from `eligible` to `paid`.

## Ops checks

- Run expiry job with `x-cron-secret` and review expired counts.
- Verify host panel reflects request updates.
- Confirm no duplicate payout rows per booking.

## Incident triage

- **Overlap booking failures**: inspect conflicting confirmed bookings or blocks.
- **Unexpected pending volume**: verify host response SLAs and expiry job cadence.
- **Payout disputes**: use booking ID + payout note/reference trail.

