---
title: "Properties mobile parentNode stability fix"
audiences:
  - TENANT
  - HOST
areas:
  - Properties
  - Mobile
  - Stability
published_at: "2026-03-23"
---

## What was fixed

- Fixed a mobile `/properties` runtime crash caused by invalid nested interactive markup in button-styled navigation actions.
- Replaced the unsafe anchor-plus-button nesting with a safe button-styled link pattern.

## What this means

- Mobile property browsing no longer crashes on the warmed `/properties` path that follows recent browse-intent state.
- Saved-search and create-listing calls to action still behave the same, but now render through valid DOM.

## Scope

- This was a stability fix only.
- No listing logic, search logic, or dashboard routing rules changed.
