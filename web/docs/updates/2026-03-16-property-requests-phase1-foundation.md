---
title: Property Requests Phase 1 foundation
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - permissions
  - database
summary: Added the Property Requests foundation schema, access model, shared contracts, and thin server routes for safe draft/open request creation and role-scoped reads.
---

# What changed

- Added the Phase 1 `property_requests` schema with lifecycle statuses, ownership fields, expiry support, and row-level security.
- Added shared request intent/status types, publish-readiness helpers, and role-based visibility helpers.
- Added lightweight authenticated server contracts for:
  - creating a request draft or open request
  - listing requests within the caller's allowed scope
  - reading a single request within the caller's allowed scope

# What Phase 1 covers

- Safe demand-side request storage
- Owner/admin/responder visibility boundaries
- Default privacy model where seekers cannot browse other seekers' requests
- Foundational lifecycle states: `draft`, `open`, `matched`, `closed`, `expired`, `removed`

# Intentionally deferred

- Seeker request management UI
- Host/agent request board UI
- Matching-listings response workflow
- Request moderation dashboard
- Admin app toggle for seeker-to-seeker visibility
- Request analytics/reporting

# Rollback

- Revert the commit for this batch
- If needed, add a follow-up migration rather than editing the original migration in place
