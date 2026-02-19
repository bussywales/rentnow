---
title: "Shortlets search adds nearby typeahead and smarter empty-state actions"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Search
  - Shortlets
cta_href: "/shortlets"
published_at: "2026-02-19"
---

## What changed

- Added a new **Search nearby** destination option in the shortlets `Where` typeahead, with geolocation support and a safe fallback.
- Improved destination suggestion ranking so recent/saved picks stay on top and popular hubs surface faster.
- Upgraded zero-results states with direct recovery actions:
  - **Clear dates** + **Search nearby** when date filters are active
  - **Zoom out / clear map area** when map bounds are active

## Who it affects

- Tenant: faster destination discovery and fewer dead-end empty states on `/shortlets`.
- Host/Agent: clearer discovery surface for shared links and assisted search sessions.
- Admin: no workflow changes.

## Where to find it

- `/shortlets`
