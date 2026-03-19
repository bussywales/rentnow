---
title: Tenant saved items empty page fix
date: 2026-03-19
audiences:
  - TENANT
areas:
  - saved
  - favourites
  - collections
---

## What was found
- Authenticated property save and collection flows were writing to Supabase-backed saved collections.
- The `/saved` page was still reading only the legacy browser-local saved store.
- That mismatch made save counts and collection actions look successful while `/saved` could still show an empty state.

## What changed
- Aligned `/saved` with the authenticated saved-collections source of truth.
- Reused the existing server-backed collections loader for authenticated users.
- Kept the legacy local saved page as the fallback for logged-out sessions or environments without Supabase.

## Rollback
- Revert the commit for this fix.
