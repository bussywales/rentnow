---
title: "Trust signals on featured listings (v1)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - UX
  - Trust
summary: "Featured discovery cards now show consistent static trust signals (Popular/New) and market-picks context across Home, Shortlets, Properties, Collections, and Saved surfaces."
published_at: "2026-02-26"
---

## What changed

- Added a shared trust-badges renderer for discovery cards with consistent pill styling.
- Added static, taxonomy-driven badge logic:
  - `POPULAR` from curated badge flag or high catalogue priority.
  - `NEW` from curated badge flag or recent catalogue introduction window.
  - `VERIFIED` only allowed when an explicit verification basis is supplied.
- Added a subtle market indicator chip (`Picks for {Market}`) on discovery and saved cards.

## Safety notes

- No backend or data-model changes were introduced.
- No user profiling or sensitive targeting is used for badges.
- Badge eligibility is validated in the discovery catalogue validator.

