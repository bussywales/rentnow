---
title: Payments pre-live hardening
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - ops
---

- Added a durable pre-live hardening plan at `docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md`.
- Implemented phase 1: Stripe webhook hardening with separate billing and shortlet webhook-secret resolution plus backward-compatible fallback to generic Stripe webhook secrets.
- Added route-specific Stripe webhook readiness visibility in admin/debug surfaces.
- Initial live scope recommendation remains disciplined: Stripe for subscriptions and non-NGN shortlets, Paystack for Nigeria-local NGN lanes, Flutterwave out of scope.
- Remaining blockers: Paystack config unification, non-Stripe subscription success backstop hardening, and featured-payments canonical model cleanup.
- Rollback: `git revert <sha>`
