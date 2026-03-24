---
title: "Homepage hero no longer shows Get started to signed-in users"
audiences: [TENANT, HOST, AGENT]
areas: [Homepage, Auth, Navigation]
published_at: "2026-03-24"
---

- The homepage hero was still showing `Get started` to signed-in users even though that link led to the anonymous registration flow.
- Signed-out visitors still see the original hero CTA trio: `Browse homes`, `Make a Request`, and `Get started`.
- Signed-in visitors now get a continuation CTA instead of signup copy:
  - tenants: `Open your home`
  - landlords and agents: `Go to workspace`
  - admins: `Open admin`

## Rollback

- Revert commit: `git revert <sha>`
