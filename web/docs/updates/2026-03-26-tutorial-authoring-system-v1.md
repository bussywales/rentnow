---
title: "Internal tutorial authoring system v1 added"
audiences:
  - ADMIN
areas:
  - help
  - admin
  - tutorials
published: true
date: "2026-03-26"
---

# What authoring system was added

- Added an internal tutorial authoring system at `/admin/help/tutorials`.
- Authorized admin users can now create and edit help tutorials without manually editing markdown files.
- The v1 flow supports:
  - title
  - slug
  - summary
  - audience
  - visibility
  - draft vs published state
  - optional YouTube URL
  - body content
  - preview

# Who can use it

- The authoring UI is internal-only.
- Admin access is required for the route and the write APIs.
- Public users and non-admin roles cannot create or edit tutorials through this system.

# How audience and visibility work

- Tenant, landlord, and agent tutorials publish to the matching public help route.
- Admin / Ops tutorials stay internal and publish only under the protected admin help route.
- New tutorials start as drafts until an admin publishes them.

# How video embedding works

- Authors paste a normal YouTube or `youtu.be` URL.
- The system extracts the video ID and shows an embed preview.
- Published tutorials render through the same reusable help video embed pattern already used in repo truth.

# Rollback

- `git revert <sha>`
