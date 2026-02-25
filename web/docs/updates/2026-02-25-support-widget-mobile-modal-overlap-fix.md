---
title: "Support widget no longer overlaps mobile modal actions"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Support
  - Mobile
summary: "Floating Help now stays behind mobile modal drawers and auto-hides while dialogs are open to avoid covering primary action buttons."
published_at: "2026-02-25"
---

## What changed

- Reduced floating support widget z-index so modal drawers remain above it.
- Added mobile dialog detection in the widget.
- When a mobile modal/dialog is open, the floating Help button hides automatically.
- If the support panel is open and a blocking dialog opens, support closes to avoid layered-action conflicts.

## Why this helps

- Prevents the Help button from covering important footer actions like **Apply** in mobile filters.
- Keeps modal interactions clear and predictable.
