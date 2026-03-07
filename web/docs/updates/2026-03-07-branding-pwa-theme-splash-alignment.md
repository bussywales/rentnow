---
title: "Aligned PWA theme and splash background colors for smoother first paint"
audiences: [TENANT, HOST, ADMIN]
areas: [BRANDING, PWA]
published_at: "2026-03-07"
---

## What changed
- Aligned PWA splash background color to the app shell first-paint tone (`#f8fafc`) in the manifest.
- Kept the brand accent theme color as `#0f172a` for browser/PWA chrome consistency.
- Added explicit iOS web app status bar metadata (`default`) for readable light-surface presentation.

## Why
- Reduces visual mismatch between install/splash surfaces and the live app shell.
- Improves perceived polish on launch, especially on iOS and installed PWAs.

## How to verify
- Reinstall the PWA or clear app/site data, then relaunch from home screen.
- Confirm splash/background appears light and transitions cleanly into the app shell.
- Confirm top browser/PWA accent remains the dark brand color.

## Rollback plan
- Revert commit `chore(branding): align pwa theme and background colours`.
