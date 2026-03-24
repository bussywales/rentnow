---
title: "CI release health agent report discipline refinement"
audiences:
  - ADMIN
areas:
  - ops
  - automation
  - docs
published: true
date: "2026-03-24"
---

# What reporting problem was found

- CI and release-health reports were useful, but they could blur currently observed red or green state with historically unstable areas and with inference made when live workflow metadata was unavailable.
- That made some reports sound more certain than the available evidence justified.

# What changed

- The CI & Release Health Agent spec now requires three explicit evidence buckets:
  - current observed health
  - historical instability patterns
  - unverified risks / unknowns
- The report template now starts with evidence confidence before any health claims.
- Action guidance now distinguishes:
  - `no action`
  - `monitor only`
  - `verify release gate`
  - `stabilization batch`
  - `workflow diagnostics batch`

# What this means for future reports

- Historical failures can still shape likely root-cause families.
- They can no longer be presented as active blockers unless current evidence proves the lane is red.
- When live workflow metadata is missing, reports must say that current state is unverified instead of guessing.

# Rollback

- `git revert <sha>`
