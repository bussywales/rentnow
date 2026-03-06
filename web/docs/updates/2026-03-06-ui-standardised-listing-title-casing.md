---
title: "Standardized listing title casing across discovery cards"
areas: [Explore, Listings, UI]
audiences: [TENANT]
published_at: "2026-03-06"
---

## What changed
- Listing titles on tenant-facing cards and rails now render in consistent Title Case for a cleaner premium look.
- Formatting is display-only and does not modify stored listing titles in the database.
- Edge cases such as acronyms, Roman numerals, and numeric title tokens are handled by a shared UI formatter.

## Rollback plan
- Revert commit `feat(ui): standardise listing title casing on cards`.
- If urgent, remove usage of `formatListingTitle` from tenant card/rail components.
