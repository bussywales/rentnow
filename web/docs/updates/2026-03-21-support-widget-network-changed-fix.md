---
title: "Support Widget Smoke Stabilisation"
audiences:
  - ADMIN
areas:
  - stability
  - support
  - testing
published_at: "2026-03-21"
source_ref: "web/components/support/SupportWidget.tsx"
---

# Support Widget Smoke Stabilisation

We stabilised the support widget escalation smoke flow.

## What was found

The blocker was not a broken escalation backend.

The widget's escalation CTA used a toggle-style state change, which made the escalation form vulnerable to duplicate activation during repeated smoke runs. That left the form closed intermittently even after the CTA had been clicked.

The previously reported `ERR_NETWORK_CHANGED` console noise was not the reproducible root cause in this batch.

## What was fixed

- the support widget escalation CTA now opens the escalation form deterministically instead of toggling it open and closed
- unit coverage now locks that contract in place

## What remained intentionally excluded

- the parked Payments Guardian follow-up local changes were left out of this batch
- no payment routing, webhook, or billing config changes were included here

## Rollback

- `git revert <sha>`
