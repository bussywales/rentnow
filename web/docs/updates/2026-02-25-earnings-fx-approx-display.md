---
title: "Host earnings now show daily FX approximations by market"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - Earnings
  - Shortlets
summary: "Host earnings cards now keep native currency totals primary and show a daily FX approximate value in selected market currency when rates are available."
published_at: "2026-02-25"
---

## What changed

- Updated `/host/earnings` summary cards to show:
  - native totals by booking currency (primary, unchanged)
  - a secondary `Approx: {market currency}` line using daily cached rates
- Approx lines now include the snapshot date, for example:
  - `Approx: CA$12,345.67 (rates 2026-02-25)`
- Added safe fallback behavior:
  - when rates are unavailable or incomplete, the page does not guess values
  - cards show `Approx unavailable (missing rates).`

## Important trust guardrail

- This is display-only conversion.
- Payout logic and booking accounting remain in the original booking currency.
