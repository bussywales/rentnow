# Product Updates Notes Import

Use this folder as the source of truth for notes imported from **Admin → Product updates → Import notes**.

## File naming

- Format: `YYYY-MM-DD-short-slug.md`
- Example: `2026-02-12-saved-search-email-alerts.md`

## Audience mapping (important)

- Allowed note audiences: `TENANT`, `HOST`, `AGENT`, `ADMIN`
- Product update audiences are mapped as:
  - `TENANT` -> `tenant`
  - `HOST` -> `host`
  - `AGENT` -> `host`
  - `ADMIN` -> `admin`
- This means **AGENT + HOST both publish into product audience `host`**.

## Required frontmatter

Every importable note must include frontmatter with:

- `title`
- `audiences`
- `areas`

Optional:

- `cta_href` (should be a valid in-app route like `/saved-searches`)
- `published_at`
- `source_ref`

## Copy/paste template

```md
---
title: "Short feature title"
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - Search
  - Alerts
cta_href: "/saved-searches"
published_at: "2026-02-12"
---

What changed:
- One short bullet.

Who it affects:
- Tenant: short impact.
- Host/Agent: short impact.
- Admin: short impact.

Where to find it:
- `/saved-searches`
