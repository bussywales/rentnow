---
title: "Accessibility improvements across discovery"
audiences:
  - TENANT
areas:
  - Tenant
  - UX
  - Accessibility
summary: "Discovery sheets, filter drawers, rails, and save/view controls now have stronger keyboard support, clearer ARIA semantics, and motion-safe interactions."
published_at: "2026-02-26"
---

## What changed

- Improved trigger semantics for mobile quick search and filter drawers:
  - added `aria-expanded`, `aria-controls`, and `aria-haspopup="dialog"` to discovery entry points.
- Upgraded shared sheet/drawer accessibility behaviour:
  - Escape closes dialogs
  - focus is trapped while open
  - focus returns to the previous trigger on close.
- Improved discovery rail semantics and keyboard support:
  - labeled regions/carousels for featured, saved, recently viewed, shortlets, properties, and collections rails
  - arrow/home/end keyboard navigation on client rails
  - motion-safe scrolling (`motion-reduce`) support.
- Improved save/view control labels:
  - save toggle now exposes contextual `aria-label` and `aria-pressed`
  - continue-browsing control now exposes clearer region and action labels.
