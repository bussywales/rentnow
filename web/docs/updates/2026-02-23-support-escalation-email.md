---
title: "Support escalation pipeline (DB + email)"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Support
  - Operations
cta_href: "/support"
published_at: "2026-02-23"
---

## What changed

- Added `/api/support/escalate` to route AI escalation requests into `support_requests`.
- Escalation now stores structured support metadata (page URL, booking/property/payment refs, and AI transcript context).
- Added admin support inbox notification via Resend to `support@propatyhub.com`.
- The global support widget now submits escalations directly and returns a ticket reference.

## Who it affects

- Tenant/Host/Agent:
  - Can escalate unresolved issues to human support directly from the widget.
- Admin:
  - Receives escalation email notifications with ticket context.

## Where to find it

- Site-wide support widget
- `/support`

