---
title: "Product updates import is now fault-tolerant"
audiences:
  - ADMIN
areas:
  - Updates
  - Admin
cta_href: "/admin/product-updates/import"
published_at: "2026-02-12"
---

## What changed

- Fixed the `/admin/product-updates/import` crash caused by malformed note files.
- Import now skips invalid markdown notes and shows inline parse errors per filename.
- Added import summary cards for:
  - New since import
  - Needs sync
  - Up to date
- Import API now returns validation-friendly errors for invalid or missing note files.

## Notes

- Import source remains `web/docs/updates/*.md`.
- Notes must include frontmatter (`title`, `audiences`, `areas`) to be importable.
