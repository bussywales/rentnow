---
title: Property Requests board shows prior responder activity
date: 2026-03-17
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - product
  - requests
  - ux
summary: Added responder-specific board state on Property Requests so hosts and agents can see when they have already sent matching listings without reopening the request detail page.
---

## What changed

Hosts and agents now see a compact responded state directly on the Property Requests discovery board when they have already sent matching listings for a request.

## How prior activity now appears

If the current responder has already acted on a request, the board now shows:

- `Responded`
- or `Responded · {n} listings sent`

The request stays visible on the board. The primary action label also changes from `Open request` to `View request` once the current responder has already sent listings.

## Rollback

- `git revert <sha>`
