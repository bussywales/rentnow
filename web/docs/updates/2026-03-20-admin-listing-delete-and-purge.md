---
title: "Admin listing deactivate and permanent delete workflow"
date: "2026-03-20"
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - moderation
---

## What was added

Admins now have two distinct listing-removal actions in `/admin/listings/[id]`:

- `Deactivate listing`
- `Delete permanently`

The listings registry also now understands the explicit `removed` status so marketplace removal is visible and consistent across admin and host surfaces.

## Deactivate vs permanent delete

`Deactivate listing` is now the default marketplace takedown action:

- sets the listing to `removed`
- removes it from public discovery
- clears featured visibility
- revokes active property share links
- keeps operational history intact

`Delete permanently` is stronger and irreversible:

- only available after the listing is already `removed`
- requires an admin reason
- requires typed `DELETE` confirmation
- is blocked when protected history still exists

## Dependency cleanup approach

Permanent delete uses an explicit dependency audit:

- protected history blocks purge
  - bookings
  - payments
  - leads
  - message threads
  - viewing requests
  - commission records
  - property-request match records
- cleanup-only records may be deleted by cascade
  - media
  - share links
  - saved references
  - analytics/check-in telemetry
  - shortlet settings

Purge now also preserves a lightweight admin audit record with the deleted listing id and reason so irreversible removal is still traceable after the row is gone.

## Rollback

- `git revert <sha>`
