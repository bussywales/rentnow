---
title: "Agent profile links no longer break when slugs are missing"
audiences:
  - TENANT
  - AGENT
  - ADMIN
areas:
  - Tenant
  - Agent
  - Admin
  - Directory
summary: "Fixed agents directory profile links to fall back safely by id, added /agents/u/[id] fallback routing, and restored automatic public slug generation for agents missing a slug."
published_at: "2026-02-28"
---

## What changed

- Updated `/agents` directory links to use `/agents/[slug]` when available, and `/agents/u/[id]` when slug is missing.
- Added a new fallback route at `/agents/u/[id]`:
  - redirects to canonical `/agents/[slug]` when a slug exists
  - renders public profile by id when slug is still missing
- Restored automatic public slug creation during agent profile save when missing, with uniqueness and safe normalization.

## Why this helps

- “View profile” links from the agents directory no longer land on 404 due to missing slug data.
- Agents missing a public slug self-heal to a stable canonical public profile URL.
