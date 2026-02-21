---
title: "Faster image delivery for shortlets and property browsing"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Shortlets
  - Properties
  - Search
cta_href: "/shortlets"
published_at: "2026-02-21"
---

## What changed

- Switched Next.js image delivery back to optimised mode, with safe remote host allowlists for Unsplash and Supabase-hosted images.
- Added a shared loading profile so only above-the-fold carousel images load eagerly:
  - `/shortlets`: first 3 desktop cards and first 2 mobile cards.
  - `/properties` list cards: first 3 cards.
- Kept non-visible slides lazy by default, including carousel slide 2+ for each card.

## Why this matters

- Faster initial render on slower networks with lower early image bandwidth usage.
- Cleaner loading behavior with fewer simultaneous image requests while preserving current UI and booking behavior.
