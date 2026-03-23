---
title: "Admin listings registry search and sort upgrade"
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - ops
published: true
date: "2026-03-23"
---

# What changed

- Upgraded `/admin/listings` with one server-side search box for:
  - listing title
  - listing ID
  - owner identity where available in current query model
  - location text such as city, area, and market labels
- Added clearer server-side sort options:
  - default order (updated newest)
  - created newest / oldest
  - updated oldest
  - expiry soonest
  - quality highest / lowest
  - title A-Z
  - live / approved newest
- Moved quality-state and quick gap filtering into URL-persisted registry controls so search, sort, and filters now share one reload-safe view.

# Deferred

- Owner search still depends on safe profile data already available to the registry.
- There is no new bulk action, export, or saved advanced view layer in this batch.

# Rollback

- `git revert <sha>`
