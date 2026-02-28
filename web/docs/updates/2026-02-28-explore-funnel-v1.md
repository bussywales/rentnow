---
title: "Explore now gives clearer next steps (and improved reliability)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - Conversion
  - UX
summary: "Explore now tracks a full local-first funnel, adds clearer request-viewing success and retry states, and includes a tenant-only CSV export for local analytics debugging."
published_at: "2026-02-28"
---

## What changed

- Added local-first funnel instrumentation for Explore actions, including next-steps opens, request composer opens, request submit attempt/success/fail, and continue-to-booking attempts.
- Improved request-viewing UX with explicit success state, clearer failure state, and an inline retry action.
- Added a tenant-only hidden debug route at `/tenant/debug/explore-analytics` for exporting and clearing local Explore analytics events as CSV.

## Why this helps

- Gives clearer feedback during high-intent actions so users understand when a request was sent or needs retry.
- Makes conversion troubleshooting easier without introducing server-side profiling or storing message/contact content.
- Keeps metrics actionable and privacy-safe with local-only event storage and export.
