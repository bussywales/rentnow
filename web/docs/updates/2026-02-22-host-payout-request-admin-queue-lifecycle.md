---
title: "Host payout requests now feed the admin payout queue"
audiences:
  - HOST
  - ADMIN
areas:
  - Host
  - Admin
  - Payments
cta_href: "/admin/shortlets/payouts"
published_at: "2026-02-22"
---

## What changed

- Host payout requests now create and dedupe `request_payout` audit events through `/api/host/shortlets/payouts/request`.
- Admin payouts now default to a `Requested` queue view, with request metadata (time, method, note) visible before payout processing.
- CSV export includes payout-request metadata columns and queue filtering.

## Why this matters

- Hosts can trigger a clear, auditable payout request flow instead of relying on manual backchannel follow-ups.
- Admin ops can process a focused queue and keep payout actions traceable end-to-end.
