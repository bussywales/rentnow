---
title: "Paystack cutover matrix and webhook guidance clarified"
audiences:
  - ADMIN
areas:
  - payments
  - ops
  - docs
published: true
date: "2026-03-24"
---

# What ambiguity was found

- The payments docs already acknowledged that repo truth still has two Paystack ingress routes:
  - `/api/billing/webhook`
  - `/api/webhooks/paystack`
- What was still too ambiguous for operators was which payment lane depended on which route during staged live rollout.

# What guidance was added

- Added an explicit lane-to-webhook cutover matrix to the final cutover plan and Paystack runbook.
- The matrix now distinguishes:
  - Paystack subscriptions
  - Paystack shortlet NGN lanes
  - Paystack NGN PAYG listing fees
  - canonical featured activation payments
  - legacy PAYG featured lane
  - Flutterwave out-of-scope posture
- The docs now state which lanes are canonical, legacy, staged, or out of scope.

# How operators should think about Paystack ingress now

- Treat Paystack cutover as staged by route family, not as one blanket “Paystack is live” switch.
- `/api/webhooks/paystack` is the route family for:
  - Paystack shortlet NGN
  - canonical featured activation
- `/api/billing/webhook` is the route family for:
  - Paystack subscription backstop
  - Paystack NGN PAYG listing fees
  - legacy PAYG featured listing charges
- Do not assume one Paystack dashboard webhook URL safely covers both route families at the same time.

# Rollback

- `git revert <sha>`
