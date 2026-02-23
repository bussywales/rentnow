---
title: "Admin toggle: auto-approve listings on submit"
audiences:
  - ADMIN
  - TENANT
  - HOST
  - AGENT
areas:
  - Admin
  - Listings
cta_href: "/admin/settings"
published_at: "2026-02-23"
---

## What changed

- Added a new admin feature flag: `listings_auto_approve_enabled`.
- When enabled, listing submit now auto-approves and sets listing status to `live`.
- When disabled, submit behavior remains unchanged (`pending` for manual review).

## Safety and auditability

- The toggle is reversible in Admin Settings at any time.
- Submit route now records a `listing_auto_approved` property event when auto-approval is applied.

## Who it affects

- Admin: can enable or disable auto-approval from `/admin/settings`.
- Host/Agent (landlord and agent roles): listing submit can publish immediately when enabled.
