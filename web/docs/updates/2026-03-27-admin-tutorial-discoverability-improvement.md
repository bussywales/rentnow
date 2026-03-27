---
title: Admin tutorial discoverability improvement
audiences:
  - ADMIN
areas:
  - navigation
  - help
  - tutorials
date: 2026-03-27
---

## What changed

Admins can now reach the tutorial authoring system from higher-visibility internal entry points instead of relying on the workspace sidebar alone.

- Added **Help Tutorials** to the admin top navigation.
- Aligned internal admin help links to use the same **Help Tutorials** label.
- Updated the help publishing guide to point admins to the new access path.

## Why this changed

The tutorial editor was already shipped, but discoverability was weak because the workspace sidebar is not consistently present across all admin pages. Admins needed a more reliable path from navigation they already use frequently.

## Rollback

Revert commit `git revert <sha>` if this discoverability change needs to be undone.
