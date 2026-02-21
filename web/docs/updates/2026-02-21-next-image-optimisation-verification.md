---
title: "Verified next/image optimisation delivery on shortlets and properties"
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

- Verified that production pages now serve listing imagery through Next image optimisation (`/_next/image`) on `/shortlets`, `/properties?stay=shortlet`, and `/properties/[id]`.
- Confirmed key card/gallery surfaces already use `next/image` and do not rely on raw `<img>` for primary listing imagery.
- Added regression protection in CI so `images.unoptimized: true` and raw `<img>` usage on guarded surfaces are blocked before merge.

## Verification snapshot

- `/_next/image` requests were observed in production network traffic for key shortlet and property surfaces with `200` responses.
- Sample byte check (card-size derivative):
  - original Supabase image: `98,554` bytes
  - optimised `/_next/image` (`w=640,q=75`): `31,433` bytes
  - reduction: `68.11%`
