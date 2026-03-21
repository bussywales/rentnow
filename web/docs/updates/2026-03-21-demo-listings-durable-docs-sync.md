---
title: "Demo listings durable docs sync"
audiences:
  - ADMIN
  - HOST
  - AGENT
areas:
  - docs
  - help
  - listings
published_at: "2026-03-21"
---

# Demo listings durable docs sync

We updated the durable help and admin docs for demo listings so they match the shipped workflow more clearly.

## What was updated

- host and agent docs now explain where demo listings are set in the editor
- durable help now explains expected badge and watermark behavior
- admin docs now separate:
  - listing-level demo toggles in `/admin/listings`
  - visibility policy in `/admin/settings`
  - badge and watermark presentation controls
- the help coverage audit now tracks demo listings as a durable covered lane

## Why this matters

This closes documentation drift where release notes described demo listing behavior more clearly than the long-lived help and admin docs.

## Rollback

- `git revert <sha>`
