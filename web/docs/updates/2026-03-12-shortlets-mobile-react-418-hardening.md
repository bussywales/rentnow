---
title: "Shortlets mobile React 418 hardening"
audiences: [TENANT]
areas: [shortlets, hydration, runtime]
published_at: "2026-03-12"
---

## What changed
- Removed nonessential server-side role lookup from `/shortlets` so the route hands a more deterministic payload into the client-only search shell.
- Added a lightweight fallback shell to the existing no-SSR shortlets wrapper so the server and client share stable first-paint markup while the mobile search UI loads.
- Tightened the shortlets hydration-hardening source tests to cover the fallback boundary explicitly.

## Why this helps
- The shortlets mobile route now has a more stable entry boundary under warm reloads and cached second-run go-live conditions.
- The fallback shell reduces the chance of React hydration recovery on `/shortlets` when client timing shifts between runs.
- Removing the unused auth-derived viewer role from the route keeps shortlets startup focused on search state, not server session work.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
