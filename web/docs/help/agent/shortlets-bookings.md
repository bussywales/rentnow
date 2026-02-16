---
title: "Agent shortlets: bookings inbox"
description: "Handle delegated host booking requests and keep shortlet availability in sync."
order: 36
updated_at: "2026-02-16"
---

## Where to work

- Open `/host` and switch to **Bookings**.
- If acting on behalf of a host, ensure delegation is active before approving or declining.

## Booking workflow

1. Filter to `Pending` in the bookings inbox.
2. Confirm listing, dates, nights, and total.
3. Use **Approve** or **Decline**.

Only paid requests reach the inbox. Checkout is completed by guests with Stripe or Paystack before host-side approval actions.

## Availability controls

- In **Availability and pricing**, update booking mode and stay rules.
- Use `/host/shortlets/blocks` to block/unblock dates when calendars change.

## Agent quality tips

- Respond quickly to pending requests to keep conversion healthy.
- Add decline reasons when useful for host visibility.
- Keep blocked dates current to reduce avoidable guest friction.
