---
title: "Private first name and surname fields in profile settings"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Profile
  - Trust
cta_href: "/profile"
published_at: "2026-02-24"
---

## What changed

- Added new private profile fields:
  - `First name (private)`
  - `Surname (private)`
- Added helper copy in profile settings clarifying privacy:
  - “Used for support and account verification. Not shown publicly.”
- Kept `display_name` as the public-facing name.

## Privacy behaviour

- The new fields are only editable from `/profile`.
- Public-facing surfaces continue to use public profile naming paths (`display_name`, with existing fallbacks).
- No change to listing, booking, payment, or public profile routing behaviour.
