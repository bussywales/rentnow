---
title: "Help Centre redesign and docs-to-draft update sync"
audiences:
  - ADMIN
areas:
  - Help
  - Product Updates
  - Ops
cta_href: "/admin/product-updates/import"
published_at: "2026-02-13"
---

What changed:
- Added a new docs-backed Help Centre structure for tenant, landlord, agent, and admin roles.
- Added shared troubleshooting and success hubs powered by markdown docs.
- Added a new sync endpoint to import `web/docs/updates/*.md` into product update drafts idempotently.
- Added an admin “Sync from docs” button on Product updates import page.
- Added CI guardrails so key code changes require help doc updates (or a documented no-help-change justification).

Where to find it:
- Help landing: `/help`
- Role guides: `/help/tenant`, `/help/landlord`, `/help/agent`, `/help/admin`
- Product updates import + sync: `/admin/product-updates/import`
