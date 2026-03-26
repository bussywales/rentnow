---
title: "Admin listings registry video tutorial added"
audiences:
  - ADMIN
areas:
  - help
  - listings
  - docs
published: true
date: "2026-03-26"
---

# What tutorial was added

- Added a new internal admin help page:
  - `Admin Listings Registry (Updated): Filters, Saved Views & Bulk Delete on PropatyHub`
- The tutorial lives in the protected admin help path and explains the updated listings registry workflow for real operators.

# How video embedding is handled

- The tutorial uses the existing reusable `<YouTube id="..." />` help-article pattern.
- The embedded video uses the YouTube ID from:
  - `https://youtu.be/_jWHH5MQMAk`
- The admin help-publishing guide was also corrected to point future tutorials at the current file-based `web/docs/help/<audience>/` model.

# Reusable pattern

- No large new framework was introduced.
- Future video-backed tutorials can follow the same markdown-based help pattern and embed YouTube using the existing reusable help article component.

# Rollback

- `git revert <sha>`
