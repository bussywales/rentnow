---
title: "Fixed admin listing inspector image gallery rendering"
areas: [Admin, Listings, Media]
audiences: [ADMIN]
published_at: "2026-03-05"
---

## What changed
- Fixed `/admin/listings/[id]` inspector media loading so cover and gallery images render reliably.
- Admin review detail media now resolves storage-path-backed images into usable URLs before returning the payload.
- Media ordering now respects cover-image priority and configured image position.

## Rollback plan
- Revert commit `fix(admin): show listing images in inspector`.
