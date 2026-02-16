---
title: "Landlord shortlets: bookings inbox"
description: "Review pending requests, approve or decline quickly, and keep availability accurate."
order: 36
updated_at: "2026-02-16"
---

## Bookings inbox location

- Open `/host` and switch to the **Bookings** section.
- Pending requests are highlighted with a bookings count and top callout.
- The inbox only shows paid booking requests and confirmed reservations.

## Responding to requests

1. Open **Bookings** and filter to `Pending`.
2. Review dates, nights, and totals.
3. Use **Approve** to confirm or **Decline** to reject.

When status is no longer pending, the decision endpoints return a conflict response to prevent duplicate actions.

## Availability management

- Open `/host` > **Bookings** > **Availability and pricing** to set:
  - request vs instant mode
  - nightly price
  - min/max nights
- Open `/host/shortlets/blocks` to block or unblock date ranges.

## Best-practice response speed

- Respond to pending requests daily.
- Keep blocked dates current to avoid avoidable declines.
- Use instant mode only when your calendar is consistently accurate.

<Callout type="warning">
Manual payouts remain unchanged in this pilot. Booking decisions should be based on real availability and stay readiness.
</Callout>

<Callout type="info">
Checkout supports Stripe (global card) and Paystack (popular in Nigeria). Hosts still receive booking emails and in-app notifications after successful guest payment.
</Callout>
