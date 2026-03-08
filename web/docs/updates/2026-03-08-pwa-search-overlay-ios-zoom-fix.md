---
title: "Fixed iOS dock search zoom and pan side-effects"
audiences: [TENANT]
areas: [PWA, NAVIGATION, SEARCH]
published_at: "2026-03-08"
---

## What changed
- Updated the bottom-dock search overlay input to use a 16px minimum font size on mobile (`text-[16px] md:text-sm`) to prevent iOS Safari auto-zoom on focus.
- Added `min-w-0` safeguards to the overlay input row and input field to avoid overflow-driven horizontal pan.
- Blurred the search input before close and submit actions to clear lingering focus state after dismiss/submit.

## Why
- iOS Safari can auto-zoom focused inputs under 16px, which can cause viewport shift and persistent horizontal panning behaviour.

## How to verify
- On iPhone Safari/PWA, tap the dock Search button.
- Confirm the overlay appears in place without viewport zoom.
- Close or submit search and confirm the page does not remain horizontally pannable.

## Rollback plan
- Revert commit `fix(pwa): prevent iOS zoom/pan when opening dock search`.
