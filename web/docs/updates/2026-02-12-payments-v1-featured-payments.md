---
title: "Featured payments v1 (Paystack)"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - Featured
  - Billing
  - Admin
cta_href: "/host"
published_at: "2026-02-12"
---

## What changed

- Added a new Paystack checkout flow for Featured activation (`7 days` and `30 days` plans).
- Hosts/agents can now pay to activate a listing after admin approval of a featured request.
- Payment success is processed by webhook only, with server-side verification and idempotent activation.
- Added receipt emails for successful Featured payments.
- Added `/admin/payments` for admin reconciliation of payment records and statuses.
- Featured activation now runs through `payments` + `featured_purchases` for clear ops visibility.
