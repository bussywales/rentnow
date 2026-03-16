---
title: Property Requests Phase 2 seeker UI
date: 2026-03-16
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - product
  - requests
  - ui
summary: Added seeker-facing Property Requests pages for draft creation, publishing, editing, closing, and owner-only request management.
---

# What changed

- Added tenant-only Property Requests pages for:
  - creating a request
  - viewing `My requests`
  - managing a single request
  - editing an existing request
- Added owner-only request updates so seekers can:
  - save draft changes
  - publish a request
  - pause an open request back to draft
  - close an open request
- Kept Property Requests private by default. Seekers still cannot browse other seekers' requests.

# What seekers can now do

- Create a structured property request
- Save it as a draft
- Publish it when ready
- Edit their own request
- Pause an open request back to draft
- Close an open request they no longer need
- Review their own request list with status and expiry context

# Still deferred

- Host/agent request discovery board
- Matching-listing response workflow
- Seeker response inbox/history
- Admin moderation UI for requests
- Request analytics/reporting

# Rollback

- Revert the commit for this batch
- If later schema follow-up is needed, add a new migration rather than editing existing migrations
