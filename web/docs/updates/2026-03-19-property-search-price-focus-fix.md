---
title: Property search price focus fix
date: 2026-03-19
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - search
  - filters
  - ux
summary: Fixed the property filter drawer so price fields keep focus while typing instead of refocusing away after each character.
---

## What was found

The price fields were not mainly failing because of input type. The shared filter drawer was rerunning its focus-management cleanup on each parent rerender, which moved focus away from the active field after every character.

## What changed

- Stabilized the shared filter drawer close handling so focus cleanup only runs when the drawer actually closes.
- Updated the property filter drawer to use a stable close callback instead of recreating it on each render.
- Added regression coverage for the drawer focus-management path.

## Rollback

- `git revert <sha>`
