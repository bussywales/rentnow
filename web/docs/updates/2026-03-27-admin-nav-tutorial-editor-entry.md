---
title: "Admin nav now exposes Help Tutorials"
date: "2026-03-27"
audiences:
  - ADMIN
areas:
  - admin
  - help
  - navigation
summary: "Admins can now open the tutorial authoring system from the normal internal workspace navigation instead of relying on a memorized URL."
---

## What changed

The internal admin workspace navigation now includes a `Help Tutorials` entry that links to `/admin/help/tutorials`.

## Why this changed

The tutorial authoring system already existed, but discoverability was weak because admins had to remember or manually type the route.

## Where it appears

- admin desktop workspace sidebar
- admin mobile workspace drawer

## Rollback

Revert the batch commit with `git revert <sha>`.
