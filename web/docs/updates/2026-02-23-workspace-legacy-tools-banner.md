---
title: "Legacy tools context banner added on dashboard routes"
audiences:
  - AGENT
  - ADMIN
areas:
  - Dashboard
cta_href: "/dashboard"
published_at: "2026-02-23"
---

## What changed

- Added a subtle workspace banner on `/dashboard/*` routes for agents and admins:
  - `You’re viewing legacy tools. We’re moving these into the new workspace.`
- Added a `Hide` control with persisted preference using:
  - `workspace:legacyBanner:hidden:v1`

## Why this matters

- Clarifies that `/dashboard/*` remains available while navigation is being unified into the new workspace shell.
- Reduces confusion without changing any route behavior.
