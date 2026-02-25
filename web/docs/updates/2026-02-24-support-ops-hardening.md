---
title: "Support operations hardened with triage lifecycle, throttling, and smoke coverage"
audiences:
  - ADMIN
  - TENANT
  - HOST
  - AGENT
areas:
  - Support
  - Security
  - Reliability
cta_href: "/admin/support"
published_at: "2026-02-24"
---

## What changed

- Added admin support request lifecycle actions (`new`, `in_progress`, `resolved`) and claim ownership fields.
- Added request throttling for `/api/support/contact` and `/api/support/escalate` with stronger allowances for authenticated users.
- Added a go-live smoke test for `/admin/support` triage flow (filter + drawer + runtime error guard).

## Why it matters

- Small support teams can now process escalations end-to-end from one inbox surface.
- Anonymous abuse and retry spam are throttled without blocking normal signed-in support usage.
- CI now protects the core admin support triage workflow with a deterministic smoke check.
