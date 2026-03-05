---
title: "Demo listings visibility policy toggle (restricted vs public)"
areas: [Listings, Discovery, Settings]
audiences: [ADMIN, TENANT, HOST]
published_at: "2026-03-05"
---

## What changed
- Added an admin setting `demo_listings_visibility_policy` to control demo listing visibility.
- Default policy is **restricted**: demo listings are visible to admin and host/owner contexts only.
- Optional policy is **public**: demo listings become visible to everyone, including logged-out users.
- Applied consistently across browse/search/detail surfaces, including Explore feeds and shortlet search.

## Rollback plan
- Revert commit `feat(listings): add demo visibility policy toggle`.
- Emergency mitigation: set `demo_listings_visibility_policy` back to `restricted` in Admin Settings.
