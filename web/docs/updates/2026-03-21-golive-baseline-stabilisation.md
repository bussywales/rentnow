---
title: Go-Live Baseline Stabilisation
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - ops
  - testing
  - stability
---

# Go-Live Baseline Stabilisation

- Restored the go-live smoke baseline by fixing the dominant false-red cluster in the local Playwright harness.
- Root cause found: the go-live runner could reuse an already-running local `next start` process, which then served stale HTML pointing at deleted CSS chunks from an older build.
- First reproduced failure: `collections.mobile.smoke` on `/_next/static/chunks/f0faca1867c33b23.css` returning `500`.
- Stabilisation change: the go-live config now starts a fresh local server for each run instead of reusing an existing one.
- Verified outcome during investigation: the previously red cluster went green on a fresh server, including collections, explore, home mobile, saved, shortlets, and support widget smoke flows.
- Intentionally excluded: the parked admin listings action-label cleanup batch and other unrelated local UI work.

Rollback: `git revert <sha>`
