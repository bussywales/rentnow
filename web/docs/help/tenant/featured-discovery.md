---
title: "Tenant featured discovery strip"
description: "How the mobile featured discovery strip chooses cards by market and how to update the static catalogue safely."
order: 31
updated_at: "2026-02-25"
---

## What the strip does

- The mobile home featured strip is market-aware and static-config driven.
- It uses the selected market context (`NG`, `GB`, `CA`) and falls back to `GLOBAL` when needed.
- Cards route to existing browse destinations only:
  - `/shortlets?...`
  - `/properties?...`

## Static contribution workflow (no admin UI)

Update the catalogue in:

- `/web/lib/home/mobile-featured-discovery.catalog.ts`

Each item supports:

- `id`: stable unique identifier
- `title`, `subtitle`, `tag`
- `category`: `shortlet | rent | buy | off_plan | all`
- `marketTags`: one or more of `GLOBAL | NG | GB | CA`
- `city` and optional `shortletParams`
- `priority` (higher ranks earlier before rotation)
- optional controls: `disabled`, `validFrom`, `validTo`, `imageKey`

## Neutrality and review checklist

Before merging catalogue changes:

1. Ensure every market has balanced options across shortlets, rent, buy, and off-plan where possible.
2. Avoid stereotypes or sensitive targeting language.
3. Keep titles utility-first and location-accurate.
4. Verify no market-only entries leak into unrelated markets.
5. Run unit tests and go-live smoke to confirm deterministic routing and fallbacks.
