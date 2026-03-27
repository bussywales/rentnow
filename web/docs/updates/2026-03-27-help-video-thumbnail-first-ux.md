---
title: "Help video UX now uses thumbnail-first YouTube previews"
date: "2026-03-27"
audiences:
  - ADMIN
  - AGENT
  - HOST
  - TENANT
areas:
  - help
  - tutorials
  - ux
summary: "Help and tutorial pages now show a clean video preview card first and only load the live YouTube player after the user clicks to watch."
---

## What changed

The reusable help `<YouTube />` component now renders a thumbnail-first preview card instead of loading the live YouTube iframe immediately on page load.

## Why this changed

Always-live embeds made tutorial pages feel cluttered because YouTube chrome and branding appeared before the user chose to watch the walkthrough.

## New behavior

- tutorial pages now show a clean preview thumbnail with a play affordance
- the live YouTube player loads only after the user clicks to watch
- existing tutorial content keeps the same `<YouTube id="..." />` syntax

## Rollback

Revert the batch commit with `git revert <sha>`.
