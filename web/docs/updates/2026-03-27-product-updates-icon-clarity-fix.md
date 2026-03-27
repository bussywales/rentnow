---
title: Product updates header icon clarity fix
summary: Replaced the product updates bell-style header icon with an announcement-style megaphone so it no longer reads like personal notifications.
audiences:
  - ADMIN
  - AGENT
  - HOST
  - TENANT
areas:
  - header
  - navigation
  - product-updates
---

# Product updates header icon clarity fix

- The desktop header previously showed two bell-style controls for different meanings:
  - personal notifications
  - product updates / announcements
- Product updates now uses a megaphone-style announcement icon instead.
- The notifications control keeps the bell, so personal alerts and platform announcements are easier to distinguish at a glance.
- The product updates button copy was tightened to `Open updates` to match the announcement mental model more clearly.

Rollback

- `git revert <sha>`
