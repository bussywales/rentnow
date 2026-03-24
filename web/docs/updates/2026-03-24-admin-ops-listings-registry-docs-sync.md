---
title: "ADMIN_OPS listings registry docs sync"
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - ops
  - docs
published: true
date: "2026-03-24"
---

# What drift was found

- `web/docs/ADMIN_OPS.md` still described the older listings registry search, filter, and sort model after the stronger `/admin/listings` controls had already shipped.
- That left the quick operator runbook narrower than the dedicated listings docs and admin help.

# What the runbook now includes

- Main registry search now reflects title, listing ID, owner lookup, and location coverage.
- Sort guidance now reflects created, updated, expiry, quality, title, and live / approved views.
- Filter guidance now reflects quality state, missing-item quick filters, demo state, featured lifecycle, and the existing numeric/property filters.
- The runbook now notes that registry state is URL-backed where relevant.
- Owner identity guidance now matches the shipped full-name / email / owner-UUID fallback order, with listing ID kept secondary.
- Bulk cleanup guidance now calls out bulk deactivate, guarded bulk permanent delete, preflight summary, typed confirmation, and audit logging.

# Rollback

- `git revert <sha>`
