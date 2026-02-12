---
title: "Featured requests v1.1"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - Featured
  - Listings
  - Admin
cta_href: "/host"
published_at: "2026-02-12"
---

## What changed

- Hosts and agents can now send a **Request featured** submission from `/host` for eligible listings.
- Admins now have a dedicated approval queue at `/admin/featured/requests` with approve/reject actions and CSV export.
- Pending request idempotency is enforced so repeated clicks won’t create duplicate pending requests for the same listing.

## Who it affects

- Tenant:
  - No direct workflow changes.
- Host/Agent:
  - Request featured placement from listing cards on `/host`.
- Admin:
  - Review and process featured requests in `/admin/featured/requests`.

## Where to find it

- Host listing actions: `/host`
- Admin queue: `/admin/featured/requests`
- Existing admin featured toggle remains available in listings and review surfaces.
