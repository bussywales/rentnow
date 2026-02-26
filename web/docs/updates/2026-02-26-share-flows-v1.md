---
title: "Share collections and discovery links (v1)"
audiences:
  - TENANT
areas:
  - Tenant
  - Growth
  - SEO
published_at: "2026-02-26"
---

## What changed

- Collections pages now expose stronger OpenGraph and Twitter metadata for cleaner link previews.
- Added a share action on `/collections/:slug` that uses native share when supported and falls back to copy-link.
- Share links stay canonical and avoid user-identifying query payloads.

## Who it affects

- Tenant: can quickly share a collection link from the collection hero.

## Where to find it

- `/collections/[slug]`
