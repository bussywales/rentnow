---
title: Payments final cutover plan
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - ops
  - launch
---

- Added the final payments cutover package at `docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md`.
- Documented lane-by-lane go-live status, provider dashboard configuration checks, admin/operator checks, manual smoke tests, and rollback steps.
- The cutover package keeps the launch recommendation disciplined: Stripe lanes first, Paystack lanes staged, Flutterwave out.
- It also makes one remaining Paystack risk explicit for operators: the repo still has two Paystack webhook ingress routes, while dashboard webhook configuration is singular and must be handled deliberately at launch.
- Next step: execute the checklist lane by lane in live mode, not as one global payments flip.
- Rollback: `git revert <sha>`
