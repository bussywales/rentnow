---
title: Property Requests help coverage
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - docs
  - help
  - requests
summary: Added durable role-based Property Requests guidance for tenants, hosts, agents, and admins, plus updated admin ops references.
---

## What changed

- Added dedicated durable Help pages for:
  - tenants/seekers
  - landlords
  - agents
  - admins
- Updated the existing tenant, landlord, agent, and admin workflow docs so Property Requests is discoverable from core Help routes and reflects the shipped UI entry points.
- Updated admin operations documentation to include `/admin/requests`, `/admin/requests/[id]`, moderation actions, and the shipped request analytics coverage.

## Audiences covered

- Tenants can now see how to create, draft, publish, edit, pause, close, and review responses on their own requests.
- Landlords and agents can now see how to access the request board from the workspace sidebar, filter requests, and send matching listings from owned or managed inventory.
- Admins can now see how to access request moderation from the `/admin` control panel, inspect responses, and interpret the compact request analytics.

## Rollback

- Revert this commit if the docs need to be withdrawn or rewritten.
