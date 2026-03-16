---
title: Property Requests Phase 6 telemetry and reporting
date: 2026-03-16
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - analytics
summary: Added compact admin telemetry for Property Requests so teams can see demand creation, response coverage, and stalled segments by intent and market.
---

## What changed

- Expanded Property Requests reporting on the admin requests surface.
- Added compact telemetry visibility for:
  - requests created
  - requests published
  - open, matched, closed, expired, and removed requests
  - requests with responses
  - requests with zero responses
  - total responses sent
  - overall response rate
  - average and median time to first response
- Added breakdown tables by intent and by market.
- Added a stall-segments view so admins can quickly see which published request segments are attracting little or no supply response.

## What is now measurable

Admins can now answer:

- whether seekers are actually publishing demand
- whether responders are replying at all
- which intents are getting traction
- which markets are producing responses
- where published demand is stalling with zero responses
- how quickly first responses are arriving when they do happen

## What is still deferred

- no separate BI dashboard
- no public-facing analytics
- no advanced cohorting or responder-quality scoring
- no event-level action funnel beyond what request and response lifecycle data already provides

## Rollback

- Revert commit if needed:
  - `git revert <sha>`
