---
title: "Host listing management now uses canonical /host routes"
audiences:
  - HOST
  - AGENT
areas:
  - Host
  - Listings
cta_href: "/host/listings"
published_at: "2026-02-23"
---

## What changed

- Standardized listing-management navigation to host-native routes:
  - Manage all → `/host/listings`
  - Listing edit/manage → `/host/properties/[id]/edit`
  - Availability → `/host/properties/[id]/availability`
  - Shortlet settings → `/host/shortlets/[id]/settings`
- Added legacy redirects for dashboard paths so old links still land in canonical host surfaces.

## Why it matters

- Hosts and agents stay inside one workspace mental model without bouncing between `/host` and `/dashboard` during listing operations.
