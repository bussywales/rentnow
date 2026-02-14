---
title: "Landlord shortlets"
description: "Configure shortlet pricing, manage booking requests, and monitor pilot payouts."
order: 35
updated_at: "2026-02-14"
---

## Enable shortlet booking

- Set listing intent to **Shortlet** on your listing.
- Open `/host` and use the **Shortlet** section:
  - **Bookings** tab
  - **Availability & pricing** tab

## Configure availability and pricing

- Set:
  - booking mode (`instant` or `request`)
  - nightly price (required)
  - cleaning fee / deposit (optional)
  - min/max nights and notice windows
- Availability remains open by default in pilot.
- Use `/host/shortlets/blocks` for manual blocked ranges.

## Manage booking requests

From `/host` -> **Shortlet** -> **Bookings**:

1. Review incoming `pending` requests.
2. Confirm booking (`pending -> confirmed`) or decline (`pending -> declined`).
3. Cancel confirmed bookings when needed (`confirmed -> cancelled`).
4. Track upcoming and past stays in one place.

## Payout flow (pilot, manual)

- Confirmed bookings create payout candidates.
- Admin pays out manually after check-in date (or completed stay).
- Keep booking and payout references for reconciliation.
- Host dashboard shows shortlet earnings and payout status.

## Common issues

- **Cannot accept request**: request may already be expired or processed.
- **Payout not visible yet**: booking check-in date may not be reached.
- **Dates blocked**: remove conflicting block first (admin/ops support may assist).
- **Nightly price missing**: set nightly price in **Availability & pricing** before guests can book.

## Success tips

- Reply to pending requests fast.
- Keep listing details and house rules up to date.
- Monitor check-in windows to reduce payout delays.
