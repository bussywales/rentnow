---
title: Shortlets mobile React 418 fix
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - stability
  - shortlets
  - mobile
---

- Investigated the go-live blocker on `web/tests/e2e/shortlets.mobile.smoke.spec.ts`, which was failing on `/shortlets?where=Lekki&guests=2` with `Minified React error #418`.
- The root issue was the shortlets no-SSR wrapper: the server rendered the loading fallback, but a warm client-side dynamic import could render the full shortlets shell on the first client pass, creating a hydration mismatch.
- Hardened the wrapper so the shortlets route stays on the same fallback tree through the initial client render, then mounts the live shell after hydration.
- This batch intentionally excluded the parked admin listings action-label cleanup changes.
- Rollback: `git revert <sha>`
