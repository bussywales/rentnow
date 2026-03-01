---
title: "Shortlets sticky bar keeps sort visible in compact and expanded states"
summary: "Mobile shortlets now keeps the Recommended sort chip visible while collapsed and prevents sticky chip clipping with horizontal scrolling."
areas: [Tenant, Shortlets, UX]
audiences: [TENANT]
published_at: "2026-03-01"
---

## What changed
- Kept the sort control visible in both sticky states on mobile shortlets.
- Added horizontal chip-rail scrolling behavior so chips no longer clip in compact bars.
- Increased compact sort chip width so `Recommended` stays readable.

## Why
- The collapsed sticky row omitted sort entirely, and tight chip widths caused clipping in smaller viewports.
