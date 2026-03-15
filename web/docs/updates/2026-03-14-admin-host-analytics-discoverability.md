---
title: Admin host analytics discoverability
date: 2026-03-14
audiences:
  - ADMIN
areas:
  - admin
  - analytics
  - navigation
summary: Host analytics is now included in the analytics hub and shared sibling navigation so admins can move cleanly across all analytics workspaces.
rollback: git revert <sha>
---

## What changed

- Added Host analytics to the admin analytics hub destinations.
- Added Host analytics to the shared analytics sibling navigation used across analytics pages.
- Updated the host analytics page to use the same sibling nav as Marketplace analytics, Explore analytics, and Explore V2 conversion.

## Why this helps

- Host analytics is now easier to discover from the main analytics area.
- Admins can move laterally between all analytics workspaces without relying on manual URLs.
- The analytics IA now treats host analytics as a first-class analytics destination without adding noise to the main admin dashboard.

## Rollback

- Revert the commit for this batch.
