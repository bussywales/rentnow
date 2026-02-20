---
title: "Shortlets mobile map overlay now behaves like a true modal"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Search
  - Accessibility
cta_href: "/shortlets"
published_at: "2026-02-20"
---

## What changed

- Updated the mobile map overlay on `/shortlets` to use full modal semantics (`role="dialog"` + `aria-modal`).
- Added keyboard escape handling, focus trapping inside the map modal, and focus restore to the map trigger on close.
- Added body scroll lock while the modal is open and marked background content as inert.

## Why this matters

- Keyboard users can now open, navigate, and close map mode without tabbing into background content.
- Prevents accidental background scrolling and improves mobile modal reliability.
