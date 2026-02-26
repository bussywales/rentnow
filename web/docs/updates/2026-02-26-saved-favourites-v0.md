---
title: "Saved favourites (local-first)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - Retention
summary: "Discovery cards now support local save/unsave with market-aware persistence, plus a mobile Saved rail on Home for quick return visits."
published_at: "2026-02-26"
---

## What changed

- Added a lightweight local-first Saved store (`localStorage`) that is SSR-safe, market-scoped, and capped.
- Added a Save toggle on discovery cards across:
  - mobile Home featured strip,
  - Shortlets featured rail,
  - Properties featured rail,
  - Collections cards.
- Added a mobile Home **Saved** rail that appears when the current market has saved items.
- Saved items store only minimal routing-safe metadata (`id`, `kind`, `market`, `href`, `title`, optional subtitle/tag).

## Notes

- This is v0 and does not sync across devices/accounts.
- Market remains display context only; saves are scoped locally by selected market.
