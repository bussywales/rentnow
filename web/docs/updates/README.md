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
```

## Import workflow

1. Add/update note in this folder.
2. Open `/admin/product-updates/import`.
3. Import notes marked **New since import** or **Needs sync**.
4. Review drafts in `/admin/product-updates`.
5. Publish audience-specific updates.

## Definition of done

- [ ] File is named `YYYY-MM-DD-short-slug.md`
- [ ] Frontmatter is present
- [ ] Audiences are correct for impacted roles
- [ ] `cta_href` (if set) points to a valid app route
- [ ] Import completed in `/admin/product-updates/import`
- [ ] Drafts reviewed and published in `/admin/product-updates`
