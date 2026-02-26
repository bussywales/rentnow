---
title: "Market switch feels instant (discovery refresh)"
audiences:
  - TENANT
areas:
  - Tenant
  - Markets
  - Discovery
  - UX
summary: "Switching market now updates discovery surfaces instantly with a lightweight confirmation toast, without full-page reloads."
published_at: "2026-02-26"
---

## What changed

- Replaced hard browser reload on market change with instant in-app refresh.
- Added a subtle toast confirmation: `Now showing picks for {Market}`.
- Ensured discovery surfaces re-render immediately for the selected market context:
  - Home featured strip
  - Shortlets featured rail
  - Properties featured rail
  - Collections cards (via route refresh)
- Kept market semantics display-only with no new market URL params.
- Kept quick search intent defaults market-aware when switching context.
