---
title: "Notifications dropdown now polls only when active and supports stronger keyboard UX"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Core
  - Notifications
cta_href: "/"
published_at: "2026-02-20"
---

## What changed

- Notifications now refresh only while the bell dropdown is open, reducing background polling load.
- Polling pauses while the browser tab is hidden and performs one immediate refresh when visibility returns.
- The dropdown now supports stronger keyboard interaction: `Escape` closes it, and focus returns to the bell button.
- Added improved dialog semantics (`aria-expanded`, `aria-controls`, focusable panel) to make the interaction more predictable for assistive technologies.

## Why this matters

- Less background network usage and CPU churn on slower connections.
- More reliable keyboard navigation for power users and accessibility.
- Faster, cleaner notifications behaviour without changing existing unread and mark-read flows.
