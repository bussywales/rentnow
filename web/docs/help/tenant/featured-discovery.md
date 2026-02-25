---
title: "Tenant featured discovery strip"
description: "How market-aware discovery cards are selected and how admins can safely contribute via static catalogue updates."
order: 31
updated_at: "2026-02-25"
---

## What the strip does

- The mobile home featured strip is market-aware and static-config driven.
- The shortlets featured rail (`/shortlets`) uses the same market-aware taxonomy and only renders shortlet-intent entries.
- It uses the selected market context (`NG`, `CA`, `UK`, `US`) and falls back to `GLOBAL` when needed.
- Cards route to existing browse destinations only:
  - `/shortlets?...`
  - `/properties?...`

## Static contribution workflow (no admin UI)

Update these static files:

- `/web/lib/discovery/discovery-catalogue.ts`
- `/web/lib/discovery/market-taxonomy.ts`
- `/web/lib/discovery/discovery-validate.ts`
- `/web/lib/discovery/discovery-select.ts`

Each catalogue item supports:

- `id`: stable unique identifier
- `title`, optional `subtitle`
- `kind`: `shortlet | property`
- `intent`: `shortlet | rent | buy`
- `marketTags`: one or more of `GLOBAL | NG | CA | UK | US`
- `params`: query params to route into `/shortlets` or `/properties`
- `priority`: numeric ordering hint
- `surfaces`: one or more of `HOME_FEATURED | SHORTLETS_FEATURED | PROPERTIES_FEATURED`
- optional controls: `disabled`, `validFrom`, `validTo`

Selection is deterministic by market + surface + date seed, so ordering is predictable for tests and still rotates fairly over time.

## Neutrality and review checklist

Before merging catalogue changes:

1. Ensure every market has balanced options across shortlets, rent, buy, and off-plan where possible.
2. Avoid stereotypes or sensitive targeting language.
3. Keep titles utility-first and location-accurate.
4. Verify no market-only entries leak into unrelated markets.
5. Run unit tests and go-live smoke to confirm deterministic routing and fallbacks.
