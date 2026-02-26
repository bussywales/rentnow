# Saved Favourites (Local-First v0)

Saved favourites let tenants bookmark discovery cards without requiring sign-in.

## How it works

- Tap the heart button on discovery cards to save/unsave.
- Saved state is stored in your browser (`localStorage`) only.
- Saved items are scoped by selected market.

## Where save is available

- Home featured discovery strip (mobile)
- Shortlets featured rail
- Properties featured rail
- Collections cards

## Privacy and data scope

Only minimal item details are stored locally:

- item id
- kind (`shortlet` or `property`)
- market code
- destination href
- title (and optional subtitle/tag)

No payment, account, or private profile fields are stored in local saved favourites.

## Limits

- Max 100 items are retained in local storage.
- Clearing browser storage removes saved favourites.
- v0 does not sync across devices or accounts.
