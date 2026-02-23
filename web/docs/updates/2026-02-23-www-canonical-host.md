---
title: "Canonical www host redirect for stable auth sessions"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - CORE
  - AUTH
cta_href: "/"
published_at: "2026-02-23"
---

## What changed

- Added canonical host enforcement so requests to `propatyhub.com` are redirected to `https://www.propatyhub.com` with a `308` redirect.
- Preserved full path and query params during redirect.
- Kept localhost and non-canonical deployment hosts unchanged.

## Why it matters

- Prevents cookie-host mismatches that can make signed-in users appear logged out on protected pages.
