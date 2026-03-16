---
title: Property Requests Phase 4 send matching listings
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - matching
summary: Hosts and agents can now respond to eligible property requests by sending up to three managed listings through PropatyHub, while seekers can privately review received matches on their own requests.
---

# What changed

- Added a private request response workflow so eligible landlords and agents can send up to 3 matching listings from their own managed inventory to an open property request.
- Added a responder composer on eligible request detail pages with optional short notes and ownership checks.
- Added a private responses section on request detail pages so seekers can review received matches, responders can review what they sent, and admins can inspect responses.

# What hosts and agents can now do

- Open an eligible property request and send one or more matching listings they own or actively manage
- Include a short platform-mediated note with the response
- Review previously sent matches on the same request without exposing seeker contact details

# What seekers can now see

- View received matching listings on their own request
- See optional responder notes attached to those matches
- Keep request responses private to the request owner and admins

# Still deferred

- Full two-way chat or threaded negotiation
- Direct off-platform contact sharing
- Public response counts
- AI matching or ranking
- Advanced moderation tools for request responses

# Rollback

- Revert the commit for this batch
- If schema follow-up is needed, add a new migration rather than editing existing migrations
