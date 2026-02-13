---
title: "Payments ops: cron reconcile and stuck payment visibility"
audiences:
  - ADMIN
areas:
  - Payments
  - Ops
cta_href: "/admin/payments"
published_at: "2026-02-13"
---

## What changed

- Added a cron-safe reconcile route for Paystack payments at `/api/jobs/payments/reconcile`.
- Added admin reconcile modes (`batch`, `stuck`, `receipts`) while keeping reference-based reconcile.
- Added ops widgets on `/admin/payments` for:
  - stuck payments older than 30 minutes
  - succeeded payments missing receipts
- Added webhook event visibility on admin payments for easier incident triage.
- Reconcile remains idempotent for activation and receipt sending.
