---
title: "Push notifications setup is clearer for tenants"
audiences:
  - TENANT
areas:
  - Tenant
  - Notifications
  - PWA
summary: "Saved-search notification setup now gives clearer iOS/install guidance and adds basic abuse protection to push subscription endpoints."
published_at: "2026-02-27"
---

## What changed

- Improved tenant saved-search notification guidance for supported, unsupported, and iOS install-required states.
- Kept permission prompts user-initiated only and added clearer next-step messaging for install and browser capability gaps.
- Added minimal per-user rate limits to push subscribe/unsubscribe API routes to reduce abuse and accidental request bursts.

## Why this helps

- Tenants now get clearer setup instructions on iPhone/iPad and unsupported browsers.
- Push setup failures are easier to understand and recover from.
- Push endpoints are more resilient against noisy repeated requests.
