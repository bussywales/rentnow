---
title: "Trending and social proof rails on Home"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Home
  - Search
cta_href: "/properties"
published_at: "2026-02-12"
---

## What changed

- Added new Home rails for **Trending this week**, **Most saved**, and **Most viewed** on `/home` and `/tenant/home`.
- Rails use existing listing activity signals (recent views and saves) and hide automatically when there is no data.
- Trending ranking now uses a clear 7-day score formula: views + (saves × 4), with a minimum threshold before a listing can appear.
- Market preference is now reflected in ordering and copy only, so matching-country homes appear earlier when available.
- Global browse remains unchanged: listings are still discoverable across markets.
- Added a short **What is this?** explainer link to `/help/trending`.

