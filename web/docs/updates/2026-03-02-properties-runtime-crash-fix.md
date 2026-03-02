---
title: "Properties runtime stability fix"
summary: "Fixed an intermittent runtime crash affecting featured-to-properties navigation on mobile."
areas: [Tenant, Properties, Stability]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Hardened shared navigation and legal CTA markup to avoid invalid nested interactive elements.
- Added targeted e2e diagnostics to capture first-occurrence runtime breadcrumbs in home featured discovery flow.
- Stabilized shortlets desktop map smoke interaction by retrying a detached-prone "Search this area" click with a bounded safe-click strategy.

## Why
- Go-live smoke runs intermittently surfaced a `/properties` runtime crash and detached click flake that could block release gates.
- These changes keep the same user flows while reducing hydration/runtime instability under fast navigation and map rerenders.
