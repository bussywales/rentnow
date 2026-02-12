# Product Updates Notes Import

Use this folder as the source-of-truth for release notes that feed **Admin → Product updates → Import notes**.

## File naming

- Format: `YYYY-MM-DD-short-slug.md`
- Example: `2026-02-12-saved-search-email-alerts.md`

## Required frontmatter

Every importable note must include frontmatter:

```md
---
title: "Saved search email alerts"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Search
  - Alerts
cta_href: "/saved-searches"
published_at: "2026-02-12"
---
```

Required keys:

- `title`
- `audiences` (one or more of `TENANT`, `HOST`, `AGENT`, `ADMIN`)
- `areas` (free-form tags)

Optional keys:

- `cta_href`
- `published_at`
- `source_ref`

## Body format (recommended)

Keep this short and human:

- What changed
- Who it affects
- Where to find it

If audience-specific copy is needed, add mini sections:

```md
## Tenant
- ...

## Agent/Landlord
- ...

## Admin
- ...
```

## Import workflow (after each feature merge)

1. Add/update a markdown note in this folder.
2. Open `/admin/product-updates/import`.
3. Import notes marked **Not imported** or **Needs update**.
4. Review drafts in `/admin/product-updates`, then publish.

## “New notes since last import” logic

- The importer matches notes by filename (`source_ref`).
- It compares note content hashes (`source_hash`) to detect changes.
- Import page counts:
  - **New since import**: required audiences missing in `product_updates`.
  - **Needs sync**: note exists but hash changed.
  - **Up to date**: all mapped audiences already synced.
