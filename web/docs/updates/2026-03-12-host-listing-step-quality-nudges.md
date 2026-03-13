---
title: "Host listing step quality nudges"
audiences: [HOST]
areas: [listings, quality, host]
published_at: "2026-03-12"
---

## What changed
- Added step-specific listing quality nudges in the host create/edit flow so missing core items are surfaced in the section where hosts can fix them.
- Reused the shared listing completeness helper to map existing missing-item signals into contextual nudges for basics, location, pricing, details, and photos.
- Kept the existing review-step `Listing quality` summary in place so overall completeness still appears before submit.

## Why this helps hosts earlier
- Hosts now see the most relevant quality fix while they are already editing that part of the listing instead of only at submit time.
- The nudges stay supportive and concise, with at most one or two messages per section and no new publish blocking.
- Shared completeness logic keeps host guidance aligned with the wider listing quality system used elsewhere in the product.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
