---
title: "Mobile quick search: categories & presets"
audiences:
  - TENANT
  - HOST
areas:
  - Home
  - Search
  - Mobile
summary: "Mobile quick search now includes category and quick-preset rails, routes shortlet searches to /shortlets, and keeps recent-search flow intact."
published_at: "2026-02-25"
---

## What changed

- Added a category rail inside the mobile quick search bottom-sheet: To rent, For sale, Short-lets, Off-plan, and All homes.
- Added a quick-preset rail that adapts to selected category and reuses existing shortlet recents when available.
- Switched submit navigation to Next router push and fixed destination routing:
  - shortlet category searches now open `/shortlets?...`
  - property categories continue to open `/properties?...`
- Kept recent searches and clear action intact.

## Why this helps

- Mobile search starts faster with one-tap category and preset choices.
- Destination routing now matches user intent, especially for shortlet-first flows.
- Navigation is smoother without full-page reloads.
