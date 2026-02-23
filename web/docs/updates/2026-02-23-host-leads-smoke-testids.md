---
title: "Host leads smoke test selector hardening"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - Host
  - Leads
cta_href: "/host/leads"
published_at: "2026-02-23"
---

## What changed

- Added stable `data-testid` attributes on the host leads page root, filters container, and results container.
- Added Playwright smoke coverage for landlord and agent `/host/leads` load + filter interaction paths.

## Who it affects

- Landlord/Agent:
  - No visual UI change; improves regression safety for host leads workflows.
- Admin:
  - Supports smoke validation for role-safe host leads access in CI environments.

## Where to find it

- `/host/leads`
