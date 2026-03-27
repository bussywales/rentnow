---
title: Admin tutorial navigation cleanup
audiences:
  - ADMIN
areas:
  - navigation
  - help
  - tutorials
date: 2026-03-27
---

## What changed

The recent `Help Tutorials` top-nav placement was rolled back. The link now lives in a more appropriate internal admin surface:

- the admin menu drawer under **Help & Support**
- the admin workspace sidebar under **Help Tutorials**

## Why this changed

The top nav made tutorial authoring look like a primary product destination, which added header clutter and weakened the admin information architecture. Tutorial authoring is an internal tool and fits better in admin-only menu surfaces.

## Rollback

Revert commit `git revert <sha>` if this navigation cleanup needs to be undone.
