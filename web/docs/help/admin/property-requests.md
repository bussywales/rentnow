---
title: "Admin property requests"
description: "Moderate property requests, inspect responses, and monitor demand-response traction."
order: 25
updated_at: "2026-03-16"
---

## Access map

| Audience | Main routes | What they can do |
| --- | --- | --- |
| Tenant / seeker | Tenant workspace `My Requests` quick action on `/tenant`; routes `/requests`, `/requests/my`, `/requests/new`, `/requests/[id]`, `/requests/[id]/edit` | Create, draft, publish, edit, pause, close, and review responses on their own requests |
| Landlord / agent | Workspace sidebar `Property Requests`; routes `/requests`, `/requests/[id]` | Browse eligible open requests and send matching owned or managed listings |
| Admin | Admin control panel `Requests` shortcut on `/admin`; routes `/requests`, `/requests/[id]`, `/admin/requests`, `/admin/requests/[id]` | Inspect any request, inspect responses, moderate statuses, and review request analytics |

## Admin routes

- `/admin` now includes a `Requests` quick link in the control panel.
- `/admin/requests` is the operations and reporting surface.
- `/admin/requests/[id]` is the admin request inspection view.
- `/requests` and `/requests/[id]` remain available for admin read access to the role-aware request surfaces.

## What admins can inspect

On the admin request registry and detail view, admins can inspect:

- structured request fields
- owner summary and owner role
- request status, published time, and expiry
- response count and unique responder count
- response contents and matched listings
- notes and shortlet duration when present

## Moderation actions

Use `/admin/requests/[id]` to apply explicit request controls:

- `Close`
- `Expire`
- `Remove`

These controls are for spam, stale demand, invalid requests, or operational cleanup.

## Status meanings

- `draft`: private to the owner and admins
- `open`: published and eligible for responder discovery
- `matched`: demand has been matched operationally
- `closed`: owner or admin ended the request
- `expired`: request aged out of the active pool
- `removed`: request was taken out of circulation by admin action

## Analytics available now

`/admin/requests` includes compact operational reporting for:

- requests created
- requests published
- open, matched, closed, expired, and removed counts
- requests with responses
- zero-response requests
- total responses sent
- response rate
- average and median time to first response
- breakdown by intent
- breakdown by market
- stall segments showing published demand with zero responses

Newly published requests can also trigger targeted responder email alerts for landlords and agents with matching live supply in the same market. Use the zero-response and first-response sections to confirm whether alerting is improving activation.

## Privacy rules admins must preserve

- other seekers still cannot see seeker demand
- responder activity is private to the seeker owner, the sending responder, and admins
- contact details are not part of this workflow yet
- Property Requests is not a public forum or chat system

## Related guides

- [Admin core workflows](/help/admin/core-workflows)
- [Admin ops](/help/admin/ops)
