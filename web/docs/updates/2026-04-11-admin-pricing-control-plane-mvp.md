---
title: Admin Pricing Control Plane MVP
slug: admin-pricing-control-plane-mvp
date: 2026-04-11
summary: Added a first admin pricing control plane for canonical Stripe-backed subscription pricing so business users can inspect live pricing, create drafts, attach Stripe refs, publish safely, and review pricing history without asking Codex for routine row changes.
audiences:
  - ADMIN
areas:
  - billing
  - admin
cta_href: "/admin/settings/billing/prices"
published_at: 2026-04-11
---

## What changed

- Added a subscription pricing control plane to `/admin/settings/billing/prices`.
- Admin users can now inspect the live canonical price matrix, save draft Stripe-backed subscription prices, publish only when the linked Stripe recurring price matches canonical truth, and review recent pricing activity.
- Added draft/active/archived workflow state on canonical subscription rows plus lightweight pricing audit history.
- Added an internal pricing playbook at `/help/admin/support-playbooks/subscription-pricing`.

## Operational model

- PropatyHub canonical pricing remains the source of truth.
- Stripe recurring price objects are execution refs attached to canonical pricing.
- Publish creates a new active canonical row instead of mutating live price history in place.

## MVP scope limits

- This MVP is for Stripe-backed subscription pricing control.
- Paystack and Flutterwave subscription execution remain out of scope for this first batch.
- Stripe recurring price creation may still be operational, but once the ref exists the business team can complete the draft and publish inside PropatyHub.
