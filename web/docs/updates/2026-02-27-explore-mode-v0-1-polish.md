---
title: "Explore mode feels smoother (preload, swipe polish)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - UX
summary: "Polished Explore mode with adjacent image preloading, gesture-lock swipe handling, lighter action controls, and an immersive support-widget-free canvas."
published_at: "2026-02-27"
---

## What changed

- Added adjacent-slide hero image preloading in Explore mode (next/previous slide) for smoother transitions.
- Added a subtle progress cue (`current / total`) in the Explore pager.
- Added gesture axis locking so horizontal image swipes do not accidentally trigger vertical slide paging.
- Refined Explore action stack visuals with lighter button weight and clearer pressed-state feedback.
- Hid the floating support widget on `/explore` only to keep the feed unobstructed.

## Why this helps

- Makes swipe browsing feel closer to native app interaction quality.
- Reduces visual interruptions and accidental gestures.
- Keeps the rest of the site unchanged while making Explore more immersive.
