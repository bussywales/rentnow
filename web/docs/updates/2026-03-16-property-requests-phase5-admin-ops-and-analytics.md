---
title: Property Requests Phase 5 admin operations and analytics
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - admin
  - analytics
summary: Added admin request operations for closing, expiring, and removing property requests, plus a basic request analytics view covering demand creation, response coverage, and first-response timing.
---

# What changed

- Added an admin property requests registry and detail view for operational review.
- Added explicit admin moderation actions to close, expire, or remove requests.
- Added a lightweight analytics snapshot for request creation, response coverage, and first-response timing.

# What admins can now do

- Search and filter property requests by status or free text
- Inspect structured request details and private response summaries
- See request response counts and unique responder counts
- Explicitly close, expire, or remove requests when needed

# What analytics are now visible

- Requests created
- Open, closed, expired, and removed counts
- Requests with at least one response
- Non-draft requests with zero responses
- Total responses sent
- Average and median time to first response

# Still deferred

- Full request moderation workflow with audit trails
- Global admin settings for request visibility or responder eligibility
- Chat or negotiation tools
- Advanced BI dashboards or cohort reporting

# Rollback

- Revert the commit for this batch
- If schema follow-up is needed later, add a new migration rather than editing existing migrations
