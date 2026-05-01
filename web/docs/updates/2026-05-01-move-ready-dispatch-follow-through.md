---
title: "Move & Ready dispatch follow-through"
audiences:
  - HOST
  - ADMIN
areas:
  - Services
  - Operations
cta_href: "/admin/services/requests"
published_at: "2026-05-01"
summary: "Added explicit dispatch progress, structured provider responses, and operator award/no-match controls so Move & Ready requests can move from route-ready to tracked follow-through."
---

## What changed

- Admin services requests now show dispatch progress, provider response progress, and whether operator action is needed.
- Dispatched providers can now respond with structured outcomes, including interest, decline, or need-more-information plus an optional quote summary.
- Operators can now award a request to one provider or close it as no match from the existing services request workflow.
- Host-facing request details now keep PropatyHub as the intermediary instead of exposing direct supplier contact details.

## Who it affects

- Host: service requests now show clearer follow-through and stay inside PropatyHub-managed coordination.
- Admin: services requests now support dispatch tracking, provider response review, award decisions, and no-match closure.

## Where to find it

- `/admin/services/requests`
- `/host/services/requests`
- `/services/respond/[token]`
