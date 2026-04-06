---
title: Analytics instrumentation foundation
audiences:
  - ADMIN
  - TENANT
  - HOST
areas:
  - Analytics
  - Billing
  - Search
summary: Added GA4-ready acquisition attribution and a first-party product analytics event model for demand, billing, and host activation funnels.
published_at: "2026-04-06"
---

# Analytics instrumentation foundation

## What changed
- Added a GA4-ready analytics bootstrap in the root layout, gated by `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Added first-party product analytics event ingestion to `public.product_analytics_events`.
- Persisted UTM attribution in a first-party cookie so campaign metadata survives route changes.
- Instrumented the highest-value tenant, billing, and host activation events.
- Documented event naming, properties, UTM rules, and QA steps in `web/docs/ANALYTICS.md`.

## Why
- Billing, demand, and activation now need measurement discipline.
- The repo previously had fragmented analytics slices but no shared acquisition + product event foundation.
- This batch makes immediate reporting possible for campaign traffic, browse-to-intent conversion, billing conversion, and post-payment host activation.
