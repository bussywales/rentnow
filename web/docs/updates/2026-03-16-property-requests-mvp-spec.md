---
title: "Property Requests MVP specification added"
date: "2026-03-16"
summary: "Added an implementation-ready MVP spec for a new Property Requests demand-side marketplace feature."
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - marketplace
  - requests
---

## What was added

- Added a durable product and engineering specification for `Property Requests` at `docs/product/PROPERTY_REQUESTS_MVP.md`.
- Defined the MVP scope for a separate demand-side request surface where seekers post structured needs and eligible hosts/agents respond with matching listings through the platform.
- Documented permissions, visibility defaults, moderation posture, lifecycle states, analytics expectations, admin controls, and rollout order.

## Why

- The feature needs a clear build contract before implementation so later delivery batches do not drift into a chat/forum product or create privacy and moderation debt.
- The spec is designed to reuse current platform strengths: role/authz patterns, listing ownership/delegation, admin review patterns, platform-mediated response flows, and analytics infrastructure.

## Next step

- Run a dedicated implementation batch for schema design, request create/manage flows, responder discovery, structured listing responses, admin controls, and analytics.
