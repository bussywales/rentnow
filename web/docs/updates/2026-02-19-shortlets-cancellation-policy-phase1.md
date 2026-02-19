---
title: "Shortlets phase 1: cancellation policy display, filtering, and host controls"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Search
  - Host Dashboard
cta_href: "/shortlets"
published_at: "2026-02-19"
---

## What changed

- Added Phase 1 cancellation policy support for shortlets with four policy types:
  - `flexible_24h`
  - `flexible_48h`
  - `moderate_5d`
  - `strict`
- Hosts can now set cancellation policy in shortlet settings (`/host/shortlets/[id]/settings`).
- `/api/shortlets/search` now returns `cancellationPolicy`, `cancellationLabel`, and `freeCancellation`, and supports a `freeCancellation=1` filter.
- Shortlet list cards now render cancellation copy in a calmer single-line summary.
- Property details now pass cancellation label into the booking widget for clear expectations before payment.

## Rollout notes

- Schema adds `shortlet_settings.cancellation_policy` with default `flexible_48h`.
- This is display and filtering only for now; automated refunds and policy enforcement timing stay out of scope for this phase.
