---
title: "Property check-in auth and permission-state fix"
audiences:
  - ADMIN
  - AGENT
  - HOST
areas:
  - Listings
  - Auth
  - Trust
published_at: "2026-03-23"
---

# Property check-in auth and permission-state fix

## Intended rule

Property check-in is for:

- admins
- listing owners / landlords
- delegated agents managing the listing

Signed-in users without that listing relationship are not allowed to record a check-in.

## What was wrong

- The property check-in route accepted browser bearer auth in the client request, but authenticated from server cookies only.
- That could return a false unauthenticated response even when the browser session was live.
- The check-in card also mapped both `401` and `403` to `Please log in to check in.`, which hid the difference between not signed in and not authorized.

## What was fixed

- The check-in API now accepts the forwarded bearer token as an auth source.
- The route returns truthful permission codes for unsupported roles and missing owner/delegation relation.
- The edit-page check-in card now shows distinct messages for:
  - not logged in
  - signed in but not authorized for check-in
  - signed in but not linked to the listing
  - missing pinned area
  - general service failure

## State messaging now

- `401`: `Please log in to check in.`
- `403 role_not_allowed`: `Property check-in is available to admins, landlords, and delegated agents.`
- `403 listing_relation_required`: `You’re signed in, but only the listing owner or a delegated manager can check in here.`
- `400 pin_required`: `Add a pinned area first to enable check-in.`

## Rollback

- `git revert <sha>`
