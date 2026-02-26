# Search Onboarding (Mobile)

This guide explains how mobile quick search onboarding works on the public home page.

## What appears for first-time users

- Quick search shows market-aware starter suggestions when there are no local recents yet.
- The language is adjusted by market context (for example postcode/ZIP/postal code wording).
- A `Use my last search` shortcut appears only when local last-browse or last-search data exists.

## Recent feed behaviour

- The `Recent` row merges:
  - direct quick-search entries (typed searches)
  - featured discovery taps from curated surfaces
- Recents are local-first and scoped to browser storage.

## Privacy and scope

- Data is stored in localStorage only.
- No backend sync is used for this onboarding layer.
- Featured tap tracking is limited to curated discovery surfaces.
