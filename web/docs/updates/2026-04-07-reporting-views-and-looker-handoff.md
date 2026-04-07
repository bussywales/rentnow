---
title: "Reporting views and Looker Studio handoff prep"
audiences:
  - ADMIN
areas:
  - analytics
cta_href: "/help/admin/analytics"
published_at: "2026-04-07T17:00:00Z"
---

- Added the minimum SQL-backed reporting layer for dashboards in the new `reporting` schema.
- Created `reporting.checkout_funnel_daily`, `reporting.paid_host_activation_daily`, and `reporting.campaign_conversion_daily` from the real first-party analytics schema.
- Added a Looker Studio handoff pack and reporting metric dictionary so dashboard assembly can proceed without metric drift or schema guesswork.
