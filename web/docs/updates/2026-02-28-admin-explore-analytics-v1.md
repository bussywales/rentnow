---
title: Admin Explore analytics with controls and CSV exports
areas: [Admin, Tenant, Analytics, Explore]
audiences: [ADMIN, TENANT]
---

Explore funnel analytics can now be captured server-side for tenant sessions using a non-PII event schema.

Admin now has a dedicated `/admin/analytics/explore` page with:
- funnel counters (views, swipes, details opens, CTA taps, request attempts/success/fail)
- CSV exports for a single day and custom date ranges (including last 7 days)
- collection controls for kill-switch, consent-required mode, and tenant notice visibility

Tenant Explore now includes a lightweight analytics notice banner. When admin enables consent-required mode, events are not sent until consent is accepted.

The ingest path is rate-limited and fire-and-forget so Explore UX remains resilient if analytics endpoints fail.
