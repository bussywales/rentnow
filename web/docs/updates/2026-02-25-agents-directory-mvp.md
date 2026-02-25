---
title: "Agents directory MVP launched on /agents"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Discovery
  - Trust
cta_href: "/agents"
published_at: "2026-02-25"
---

## What changed

- Replaced the placeholder `/agents` page with a working directory experience.
- Added search and compact filters:
  - name/company search
  - location filter
  - verified-only toggle (enabled by default)
- Added agent cards with profile routing and trust status.
- Added resilient empty-state actions:
  - `Browse listings`
  - `Become a verified agent`

## Safety and privacy

- Directory API returns safe public fields only.
- Private profile fields (email, phone, first/last private names) are excluded.
- Profile links resolve to existing public routes (`/agents/[slug]` with `/u/[id]` fallback).
