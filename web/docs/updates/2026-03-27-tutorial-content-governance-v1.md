---
title: Tutorial content governance v1
date: 2026-03-27
audiences:
  - ADMIN
  - HOST
  - AGENT
  - TENANT
areas:
  - help
  - tutorials
  - seo
summary: Authored tutorials are now the default tutorial surface, the admin listings registry tutorial was migrated into the authored platform, and public authored tutorials now support SEO-ready metadata.
---

## What changed

- The authored tutorial platform at `/admin/help/tutorials` is now the default for walkthroughs, feature onboarding, video-led tutorials, and other frequently updated training content.
- File-backed help remains the right place for durable static runbooks, stable reference docs, and long-lived repo-reviewed operational guidance.
- `Admin Listings Registry (Updated): Filters, Saved Views & Bulk Delete on PropatyHub` was migrated into the authored tutorial platform and the old file-backed duplicate was retired.

## Public tutorial SEO readiness

- Authored tutorials now support optional SEO title and meta description fields.
- Public tutorials use clean canonical metadata on their public help routes.
- Internal admin tutorials stay route-protected and non-indexable.

## Canonical placement rule

- Default to the authored platform unless the content is truly durable static reference documentation.
- Do not ship a file-backed tutorial and an authored tutorial with the same canonical role + slug.

## Rollback

- `git revert <sha>`
