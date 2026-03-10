---
title: "Explore V2 trust-cue experiment with feature flag and variant analytics"
audiences: [TENANT, ADMIN]
areas: [explore-v2, conversion, analytics]
published_at: "2026-03-10"
---

## What changed
- Added a new feature flag: `explore_v2_trust_cue_enabled` (default OFF).
- Added one truth-based trust cue in the Explore V2 conversion sheet:
  - `Instant confirmation available`
  - Shown only when the flag is enabled and the listing has `shortlet_settings.booking_mode = "instant"`.
- Added analytics context on Explore V2 micro-sheet events:
  - `trustCueVariant`: `none` or `instant_confirmation`
  - `trustCueEnabled`: `true` or `false`
- Persisted trust-cue analytics context fields to `explore_events` for reporting compatibility.

## Why this cue only
- This batch only ships cues that are directly supported by existing listing data.
- `instant_confirmation` is sourced from real booking-mode state and is omitted when unavailable.
- No inferred or synthetic trust cues are shown.

## Verification steps
- With `explore_v2_trust_cue_enabled = false`: trust cue is not shown.
- With `explore_v2_trust_cue_enabled = true` and qualifying shortlet (`booking_mode = instant`): cue is shown.
- With `explore_v2_trust_cue_enabled = true` and non-qualifying listing: cue is hidden.
- Confirm Explore V2 CTA analytics events include `trustCueVariant` and `trustCueEnabled`.

## Rollback
- Disable `explore_v2_trust_cue_enabled`.
- Or revert commit: `git revert <sha>`.
