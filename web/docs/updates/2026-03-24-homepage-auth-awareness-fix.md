---
title: "Homepage now respects signed-in session state on first load"
audiences: [TENANT, HOST, AGENT]
areas: [Homepage, Auth, Navigation]
published_at: "2026-03-24"
---

- Fixed the homepage shell so `/` now seeds navigation and CTA state from the same refresh-capable server session path used by authenticated app routes.
- The inconsistency came from the landing layout using a weaker direct auth read while the homepage body could refresh the session later in the same request.
- Signed-in visitors now see authenticated nav/menu state on first load, while signed-out visitors still get the public landing experience.

## Rollback

- Revert commit: `git revert <sha>`
