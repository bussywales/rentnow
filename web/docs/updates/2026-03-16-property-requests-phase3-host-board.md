---
title: Property Requests Phase 3 host discovery board
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - discovery
summary: Added the first host and agent Property Requests discovery board with filters, responder-safe request detail pages, and preserved seeker owner-only management.
---

# What changed

- Added a role-aware `/requests` surface:
  - tenants still land in `My requests`
  - landlords, agents, and admins now get a request discovery board
- Added discovery filters for:
  - intent
  - market
  - city/area search
  - property type
  - bedrooms
  - move timeline
  - budget range
  - admin-only status filter
- Updated request detail pages so eligible responders can inspect structured demand safely while tenant owners still retain their manage view.

# What hosts and agents can now do

- Browse eligible open property requests
- Filter demand by key structured fields already present in the schema
- Open a request detail page to inspect requirements and expiry context
- See real structured demand without exposing seeker contact details

# Still deferred

- Send-matching-listing workflow
- Seeker response inbox/history
- Admin moderation dashboard for requests
- Public seeker-to-seeker browsing
- Request analytics/reporting

# Rollback

- Revert the commit for this batch
- If later schema follow-up is needed, add a new migration rather than editing existing migrations
