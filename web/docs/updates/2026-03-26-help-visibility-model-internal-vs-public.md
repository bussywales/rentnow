---
title: "Help visibility model separated internal admin tutorials from public help"
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - help
  - docs
  - admin
published: true
date: "2026-03-26"
---

# What visibility model was introduced

- Public help now covers tenant, landlord, and agent tutorials.
- Internal admin and ops tutorials stay under the route-protected `/help/admin/**` surface.

# How internal vs public help is now separated

- The public help landing no longer promotes admin tutorials as if they were public guides.
- Admin help remains available only to authenticated admin users through the guarded admin help route.
- The help authoring guide now states where future tutorials belong from day one.

# What this means for future tutorials

- New admin listings registry, ops, moderation, payments-ops, and other internal tutorials should be created under `web/docs/help/admin/*`.
- New landlord, agent, and tenant tutorials should stay in their public role folders.

# Rollback

- `git revert <sha>`
