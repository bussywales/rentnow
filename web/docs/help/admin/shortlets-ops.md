---
title: "Admin shortlets: ops"
description: "Monitor booking flow health, support host decisions, and run manual payout pilot safely."
order: 36
updated_at: "2026-02-15"
---

## Pilot scope

- Host inbox actions (approve/decline) are live in `/host`.
- Tenant trips are visible in `/trips`.
- Tenant discovery now includes `/properties?stay=shortlet` and home-page shortlet rails.
- Manual payouts remain the active settlement model for shortlets.

## What to monitor

- Pending request backlog and response times.
- Decline/cancel patterns for date-blocking or policy issues.
- Expiry behavior for stale pending requests.

## Support operations

1. Verify booking ID and current status.
2. Confirm whether host/agent had authority to act.
3. Check listing blocks and booking mode before recommending fixes.
4. Escalate payout disputes with booking + payout references.

## Dispute handling checklist

- Capture booking timeline (created, host response, cancellation if any).
- Confirm status transition path (`pending` -> `confirmed` / `declined` / `cancelled` / `expired`).
- Keep notes factual and route support to clear next actions.

<Callout type="warning">
Do not promise automated payout behavior in this pilot. Keep “manual payouts” messaging consistent across support responses.
</Callout>
