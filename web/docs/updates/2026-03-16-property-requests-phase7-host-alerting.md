---
title: Property Requests Phase 7 host alerting
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - notifications
summary: Added targeted email alerts for newly published Property Requests so relevant landlords and agents with matching live supply in the same market see new demand sooner.
---

## What changed

- Added targeted email alerts when a Property Request is published for the first time.
- Alerts are sent only to eligible landlords and agents who:
  - have property request alerts enabled
  - control live approved supply in the same market
  - have listing intent that matches the request intent
- Added a host and agent profile toggle to opt out of these request alert emails.

## Who gets alerted

- landlords with matching live supply in the request market
- agents with matching live supply in the request market
- agents with active delegation over a landlord who has matching live supply in the request market

Alerts are not sent for:

- draft saves
- non-publish edits
- later admin moderation changes
- generic mass-mailing to all hosts

## What is still deferred

- no digest emails
- no per-area subscription model
- no AI relevance scoring
- no notification center or responder inbox

## Rollback

- Revert commit if needed:
  - `git revert <sha>`
