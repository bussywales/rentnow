---
title: "Session stability hardening for canonical www host"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - AUTH
  - CORE
cta_href: "/"
published_at: "2026-02-23"
---

## What changed

- Hardened canonical host redirect rules so only `propatyhub.com` redirects to `www.propatyhub.com`.
- Added explicit safeguards to avoid redirecting localhost and preview hosts.

## Why this matters

- Reduces session drift from mixed hosts while keeping development and preview workflows stable.
