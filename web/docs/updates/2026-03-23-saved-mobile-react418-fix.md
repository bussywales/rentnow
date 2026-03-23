---
title: Saved mobile React 418 fix
date: 2026-03-23
audiences:
  - ADMIN
areas:
  - stability
  - saved
  - mobile
  - testing
---

# Saved mobile React 418 fix

We investigated the go-live failure on `web/tests/e2e/saved.mobile.smoke.spec.ts` where the mobile `/saved` flow could emit React `#418` during hydration.

## What we found

- The unauthenticated saved fallback rendered `SavedPageClient` as a nested `<main>` inside the app shell's own `<main>`.
- That invalid HTML structure created a real hydration mismatch risk on the saved mobile path.
- This was an app-level rendering boundary defect, not a false-red Playwright harness issue.

## What was fixed now

- `SavedPageClient` now renders a section wrapper instead of a nested `<main>`.
- The saved-page contract test now guards against reintroducing a root `<main>` in the fallback client component.

## Intentionally excluded

- The parked admin listings registry search, sorting, and filter-state batch stayed out of this change.

## Rollback

- Revert the commit for this batch with `git revert <sha>`.
