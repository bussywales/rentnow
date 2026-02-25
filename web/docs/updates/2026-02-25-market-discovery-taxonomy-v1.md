---
title: "Market discovery taxonomy v1 (static)"
audiences:
  - TENANT
  - HOST
areas:
  - Tenant
  - Discovery
  - Markets
summary: "Introduced a shared static discovery taxonomy and deterministic market-aware selector for mobile featured discovery."
published_at: "2026-02-25"
---

## What changed

- Added a shared static discovery taxonomy under `/web/lib/discovery/*` for market-aware curated cards.
- Added lightweight schema validation (no runtime dependencies) with safe filtering for invalid, disabled, and out-of-window items.
- Added deterministic market-aware selection by `market + surface + date seed`, with `GLOBAL` fallback when a market has insufficient items.
- Wired mobile home featured discovery to the new shared selector while preserving destination routing behaviour.

## Admin contribution (static)

Admins can propose catalogue edits via repository commit/PR using the documented schema in:

- `/web/docs/help/tenant/featured-discovery.md`

No admin UI is required for v1.
