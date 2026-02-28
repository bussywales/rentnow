---
title: "Request viewing is faster (availability chips + better success flow)"
audiences:
  - TENANT
areas:
  - Tenant
  - Explore
  - Conversion
  - UX
summary: "Explore request-viewing now includes quick availability chips, clearer success actions, and close protection while requests are sending."
published_at: "2026-02-28"
---

## What changed

- Added quick availability chips in Explore request viewing (`Weekdays`, `Weekends`, `Evenings`, `Anytime`) that auto-fill and replace availability text without duplicate lines.
- Improved request success state with:
  - `Continue exploring` (closes request flow and keeps users in Explore),
  - `View requests` (links to `/tenant/viewings`).
- Prevented accidental sheet dismissal while request submission is in progress by guarding close actions and showing a sending hint.

## Why this helps

- Reduces typing friction and speeds up high-intent requests.
- Gives users clearer post-submit next steps.
- Lowers frustration from accidental close events during send.
