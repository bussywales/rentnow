---
title: Property search price input fix
date: 2026-03-19
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - search
  - filters
  - ux
---

## What changed
- Fixed the property search filter drawer so `Price min` and `Price max` accept normal multi-digit typed input.
- Kept numeric keyboard hints for mobile while removing the browser-native number-input behaviour that was making entry awkward.

## What was fixed
- Price fields no longer behave like one-character spinner controls while editing.
- Typed values are preserved as clean digit strings until filters are applied.
- Apply, reset, and clear behaviour continue to use the entered values correctly.

## Rollback
- Revert the commit for this fix.
