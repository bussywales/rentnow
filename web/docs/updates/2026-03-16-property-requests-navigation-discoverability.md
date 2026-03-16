---
title: Property Requests navigation discoverability
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - navigation
  - requests
  - account
summary: Added role-based navigation entry points for Property Requests across tenant, host, and admin surfaces.
---

## What changed

- Tenant workspace now includes a visible `My Requests` entry point to `/requests/my`.
- Host and agent workspace navigation now includes `Property Requests` linking to `/requests`.
- The admin control panel now includes `Requests` linking to `/admin/requests`.

## Which roles now see which entry points

- Tenants: `My Requests` on the tenant workspace.
- Hosts and agents: `Property Requests` in the workspace sidebar.
- Admins: `Requests` in the admin control panel quick links.

## Rollback

- Revert this commit if the navigation changes need to be withdrawn.
