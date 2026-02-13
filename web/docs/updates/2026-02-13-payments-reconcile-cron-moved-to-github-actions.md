---
title: "Payments reconcile cron moved to GitHub Actions"
audiences:
  - ADMIN
areas:
  - OPS
  - Payments
cta_href: "/admin/payments"
published_at: "2026-02-13"
---

## What changed

- Payments reconcile scheduling now runs from GitHub Actions every 15 minutes.
- Vercel cron is no longer used for this job on Hobby.
- Reconcile endpoint and security remain unchanged: `POST /api/jobs/payments/reconcile` with `x-cron-secret`.

