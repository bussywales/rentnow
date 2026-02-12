---
title: "Phase 3: referral share tracking, deep links, and invite reminders"
audiences:
  - ADMIN
  - HOST
  - AGENT
areas:
  - Referrals
  - Dashboard
  - Analytics
cta_href: "/dashboard/referrals"
published_at: "2026-02-10"
---

# Phase 3: Referral share tracking, deep links, and invite reminders

Date: 2026-02-10

## What shipped
- Added campaign tracking links for referrals with channel labels and optional UTM tags.
- Extended `/r/[code]` redirect flow to support campaign attribution cookies and privacy-safe click tracking.
- Added campaign analytics surfaces:
  - Agent dashboard `Share analytics` section
  - `/dashboard/referrals/campaigns`
  - `/dashboard/referrals/campaigns/[id]`
- Added invite reminders workspace for agents at `/dashboard/referrals/invites`.
- Added admin attribution monitoring:
  - API: `/api/admin/referrals/attribution`
  - Page: `/admin/referrals/attribution`
- Added admin share-tracking controls in referral settings:
  - `enable_share_tracking`
  - `attribution_window_days`
  - `store_ip_hash`

## Privacy notes
- No raw email or payout values are exposed in share analytics.
- Campaign conversion lists mask referred user names.
- Raw IP is not stored; optional IP hash storage is controlled by `store_ip_hash`.

## Invite reminders v1
- Invite reminders are internal tracking only.
- No outbound SMS/email/WhatsApp sending is performed in this phase.

## How agents use it
1. Open `/dashboard/referrals`.
2. In `Share analytics`, create a campaign link (channel + name + optional UTM tags + landing path).
3. Share the generated link.
4. Review campaign metrics and conversion details in `/dashboard/referrals/campaigns`.
5. Track follow-ups in `/dashboard/referrals/invites`.

## How to disable share tracking
1. Open `/admin/settings/referrals`.
2. In `Share tracking controls`, turn off **Enable share tracking**.
3. Save settings.

When disabled, campaign analytics endpoints return `enabled: false` and UI sections show disabled-state messaging.
