---
title: "Harden billing launch readiness and operator runbooks"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-04-03"
---

## What changed
- Added billing launch-readiness, billing ops, support triage, incident template, and launch-status runbooks for PropatyHub / RentNow subscriptions.
- Added small operator guidance to `/admin/billing` and the billing action panel to reduce recovery mistakes without turning the UI into a documentation dump.
- Clarified replay safety, certified vs provisional lane posture, and the expected healthy final state after a billing recovery.

## Operator effect
- Operators now have explicit go-live checks, incident handling steps, and final-state verification criteria.
- Support can distinguish manual override masking, ignored webhooks, identity mismatch, and test-account reset eligibility without relying on tribal knowledge.
