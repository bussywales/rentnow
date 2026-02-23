---
title: "Shared workspace shell foundation for host and dashboard surfaces"
audiences:
  - HOST
  - AGENT
areas:
  - Host
  - Dashboard
cta_href: "/host"
published_at: "2026-02-23"
---

## What changed

- Added a shared workspace shell foundation with a role-aware sidebar model.
- Added a single collapse preference key for workspace navigation: `workspace:sidebar:collapsed:v1`.
- Added a responsive sidebar pattern that reflows desktop content and uses a mobile drawer.

## Why this matters

- This is the base for unifying `/host/*`, `/dashboard/*`, and other workspace routes under one consistent navigation shell.
- It removes layout drift and keeps navigation behavior predictable for landlord and agent roles.
