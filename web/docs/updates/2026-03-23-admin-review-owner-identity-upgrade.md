---
title: Admin review owner identity upgrade
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - review
published: true
date: 2026-03-23
---

# What changed

- Admin review rows, review cards, and listings rows now show owner identity before raw listing IDs.
- The primary identity fallback order is:
  - profile full name
  - email when the admin-safe auth lookup is available
  - owner UUID
- Listing IDs remain visible as secondary copyable metadata for support and debugging.

# Fallback rules

- Full name wins when `profiles.full_name` is present.
- If the profile name is missing but the admin-safe auth lookup returns an email, the email becomes the primary identity.
- If neither name nor email is available, the owner UUID becomes the primary fallback.
- The listing ID stays secondary and copyable instead of acting as the main reviewer-facing identity.

# Rollback

- `git revert <sha>`
