---
title: Admin listing review email notifications
date: 2026-03-16
audiences:
  - ADMIN
areas:
  - admin
  - notifications
  - listings
summary: Admins can now opt in to receive email alerts when a listing is submitted into the review queue.
rollback: git revert <sha>
---

## What changed

- Added an admin profile preference: `Email me when a new listing is submitted for review`.
- Listing submission now sends review emails only when a listing actually enters the admin review queue.
- The email includes the listing title, market, property type, intent, owner name when available, submitted timestamp, and a direct admin review link.

## Trigger conditions

- Sent when a listing transitions into `pending` review through the submit flow.
- Includes first-time submissions and resubmissions back into review.
- Does not send for autosaves, ordinary draft edits, already-pending listings, or auto-approved submissions that go straight to `live`.

## Rollback

- Revert the commit for this batch.
