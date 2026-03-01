---
title: "Shortlets sticky bar feels cleaner on mobile"
summary: "Expanded and collapsed sticky rows now share the same horizontal chip-rail behavior, with sort always visible and cleaner edge fading when chips overflow."
areas: [Tenant, Shortlets, UX]
audiences: [TENANT]
published_at: "2026-03-01"
---

## What changed
- Unified the sticky chip rail overflow behavior across expanded and collapsed states.
- Added subtle edge fading on overflowing chip rails for cleaner readability.
- Locked sort chip visibility and ordering with regression tests.

## Why
- The sticky experience needed consistent overflow handling between states to avoid clipping and visual rough edges on smaller screens.
