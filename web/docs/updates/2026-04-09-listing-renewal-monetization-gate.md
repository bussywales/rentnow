---
title: "Listing renewal monetization gate"
audiences:
  - ADMIN
areas:
  - listings
  - billing
cta_href: "/dashboard/billing#plans"
published_at: 2026-04-09
summary: "Expired and out-of-quota listing renewal/reactivation now enforce the same commercial entitlement gate as listing submission, with a real billing next step instead of a dead-end warning."
---

- Renewing or reactivating a listing now requires a valid listing entitlement, not just a warning-free UI path.
- When no entitlement exists, the platform sends the user into a clear monetization path:
  - primary: continue to role-aware billing plans
  - secondary: pay once for this listing when PAYG is enabled
  - fallback: save and exit
- Existing one-off listing entitlement still counts. The gate does not double-charge listings that already have a valid linked listing credit consumption.
- This batch does not redesign the listing editor or add new billing products. It closes the renewal/submission revenue leak and makes the next commercial step explicit.
