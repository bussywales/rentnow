---
title: "Agent shortlets"
description: "Run shortlet operations across managed inventory with fast booking response workflows."
order: 35
updated_at: "2026-02-14"
---

## Agent shortlet workflow

Agents can operate shortlets for owned or delegated landlord inventory:

- `/host` -> **Shortlet** -> **Bookings** for incoming/upcoming stays
- `/host` -> **Shortlet** -> **Availability & pricing** for nightly rules
- `/host/shortlets/blocks` for manual date blocks

## Operating checklist (daily)

1. Keep listing intent as **Shortlet** for bookable stays.
2. Ensure nightly pricing is configured per listing.
3. Review pending requests throughout the day.
4. Confirm or decline quickly with a clear reason when needed.
5. Escalate payout questions with booking + payout references.

## Manual payout model (pilot)

- No automatic host transfer yet.
- Admin payout queue handles settlement after eligible date.
- Use references and notes for auditability.

## Troubleshooting

- **Request status conflict**: another action already processed the booking.
- **Availability mismatch**: overlapping booking/block prevented confirmation.
- **Missing payout**: confirm booking status and check-in threshold first.
- **Cannot edit pricing**: verify delegation scope or listing ownership.

## Success tips

- Standardize response SLAs with your team.
- Use concise decline reasons for better guest recovery.
- Keep shortlet calendars clean to avoid false availability.
