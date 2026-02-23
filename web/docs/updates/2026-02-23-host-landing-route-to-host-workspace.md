---
title: "Host-side login and home routes now land in /host workspace"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Auth
  - Workspace
cta_href: "/host"
published_at: "2026-02-23"
---

## What changed

- Users with role `agent` or `landlord` now route to `/host` as their canonical workspace after login.
- `/home` now redirects host-side roles (`agent`, `landlord`) to `/host` server-side.
- Role-aware post-login fallback now resolves to:
  - `agent` / `landlord` → `/host`
  - `tenant` → `/tenant/home`
  - `admin` → `/admin`
- Explicit deep links passed via `redirect`/`next` still take priority.

## Why

- Prevents host-side users from landing on legacy `/home` surfaces.
- Keeps one consistent dashboard entry point for host operations.
