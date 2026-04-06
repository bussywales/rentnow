---
title: "Checkout funnel analytics verification hardening"
audiences:
  - "ADMIN"
areas:
  - "analytics"
  - "billing"
cta_href: "/help/admin/analytics"
published_at: "2026-04-07T10:30:00Z"
summary: "Hardened checkout funnel analytics so webhook-sourced checkout success is counted from the original Stripe webhook path even when local billing recovery is needed, and documented the real production analytics schema and dashboard build guidance."
---

# Checkout funnel analytics verification hardening

## What changed

- Hardened `checkout_succeeded` analytics to log from the original Stripe webhook path even when plan application is skipped locally.
- Prevented admin replay from creating duplicate checkout-success funnel rows.
- Added a dedicated checkout funnel QA runbook.
- Updated analytics docs and dashboard specs to use the real production schema column names.

## Operator impact

- Billing conversion analytics now better reflect successful Stripe checkouts.
- Analytics QA can verify billing funnel events with the real schema fields used in production.
- Stakeholder dashboard work can build directly against `created_at`, `session_key`, `user_role`, `utm_*`, and `page_path`.
