---
title: "Nigeria-first market defaults and selector"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Marketplace
  - Listings
cta_href: "/properties"
published_at: "2026-02-12"
---

## What changed

- PropatyHub now resolves a default market for each visitor using this order:
  - saved market preference cookie
  - geo country header (when enabled)
  - admin-configured platform default
- Nigeria (`NG` / `NGN`) is now the default fallback market.
- A lightweight header market selector has been added so users can switch market preference quickly.

## Who it affects

- Tenant:
  - Better default localisation when browsing listings.
- Host/Agent:
  - Better consistency when sharing and previewing listing prices in market-aware surfaces.

## Where to find it

- Browse: `/properties`
- Homes: `/home` and `/tenant/home`
- Market preference selector: main header
