---
title: "Admin support inbox now highlights overdue tickets with SLA age"
audiences:
  - ADMIN
areas:
  - Support
  - Operations
cta_href: "/admin/support"
published_at: "2026-02-25"
---

## What changed

- Added SLA-aware fields to support inbox rows (`age`, `SLA target`, `overdue` state).
- Added an `Age` column in `/admin/support` so ticket age is visible at a glance.
- Added an `Overdue` badge for tickets that breach SLA:
  - `new` tickets overdue after 24 hours
  - `in_progress` tickets overdue after 48 hours
- Added an `Overdue first` toggle to prioritize breached tickets.

## Why it matters

- Support ops can identify priority tickets without opening each request.
- Inbox triage is faster and more consistent with the SLA policy.
