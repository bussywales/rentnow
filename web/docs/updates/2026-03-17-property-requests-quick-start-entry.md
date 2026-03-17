---
title: "Property Requests quick-start entry on mobile home"
slug: "property-requests-quick-start-entry"
date: "2026-03-17"
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - navigation
  - requests
  - activation
summary: "Added a role-safe `Make a Request` quick-start entry to the shared mobile home surface so tenants and logged-out seekers can reach Property Request creation faster."
---

## What changed

- Added `Make a Request` to the mobile home quick-start area.
- Authenticated tenant users go directly to `/requests/new`.
- Logged-out users go through login first, then continue to `/requests/new`.

## Who sees the entry point

- Tenant seekers
- Logged-out visitors

Host and admin roles do not get the seeker request CTA on this shared surface.

## Rollback

- Revert commit
