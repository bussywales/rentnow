---
title: "Tenant shortlets: trip timeline and coordination"
description: "Understand each trip stage, what happens next, and how to send a host note without chat."
order: 37
updated_at: "2026-02-22"
---

## When to use this guide

- You have paid for a shortlet and want to understand current status.
- You are waiting for host approval in request mode.
- You need to share check-in context after booking.

## Trip timeline states

- `payment_initiated`: payment started but not confirmed yet.
- `payment_confirming`: payment succeeded and booking confirmation is still reconciling.
- `awaiting_host_approval`: request-mode booking is waiting for host decision (up to 12 hours).
- `reservation_confirmed`: booking is confirmed.
- `upcoming`: confirmed and check-in date has not started.
- `in_stay`: current date is within your booked date range.
- `completed`: stay has ended.
- `declined` / `cancelled` / `expired`: this trip is closed.

## Send a host note from Trips

1. Open `/trips/[bookingId]`.
2. Go to **Coordination**.
3. Pick a topic and submit your note.

Your note is logged for this booking and sent to the host as an in-app alert and email.

## What happens next in request mode

- The host has up to 12 hours to approve or decline.
- You can monitor progress on the timeline section in `/trips/[bookingId]`.
- If expired or declined, use **Find another stay** to restart quickly.

<Callout type="info">
PropatyHub uses booking status as the source of truth after payment. If payment succeeded and confirmation is still processing, keep monitoring the timeline instead of retrying payment.
</Callout>

## Related links

- [Trips home](/trips)
- [Need help](/help)
- [Browse shortlets](/shortlets)
