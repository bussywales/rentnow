# Saved, Recently Viewed, and Continue Browsing (Local-First)

Saved favourites and recently viewed cues help tenants return to listings quickly without requiring sign-in.

## How it works

- Tap the heart button on discovery cards to save/unsave.
- Saved state is stored in your browser (`localStorage`) only.
- Saved items are scoped by selected market.

## Where save is available

- Home featured discovery strip (mobile)
- Shortlets featured rail
- Properties featured rail
- Collections cards

## Recently viewed (v0)

- Listing taps are tracked locally from discovery/listing cards.
- Recently viewed is market-scoped and shown as a mobile rail on `/`.
- Clearing recently viewed only affects local browser data.

## Continue browsing cues

- `/shortlets`: shows a small continue chip when a previous filtered shortlets URL exists.
- `/properties`: shows a small continue chip when a previous filtered properties URL exists.
- Continue links are market-scoped and only restore whitelisted browse URLs.

## Privacy and data scope

Only minimal local data is stored:

- item id
- kind (`shortlet` or `property`)
- market code
- destination href
- title (and optional subtitle/tag)
- timestamp

No payment, account, or private profile fields are stored in local saved favourites.

## Limits

- Max 100 items are retained in local storage.
- Recently viewed retains up to 30 items.
- Clearing browser storage removes saved favourites.
- v0 does not sync across devices or accounts.
