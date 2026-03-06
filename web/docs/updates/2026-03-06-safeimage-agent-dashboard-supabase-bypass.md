---
title: "Dashboard listing images now use SafeImage for Supabase reliability"
areas: [Dashboard, Media, Reliability]
audiences: [HOST, AGENT]
published_at: "2026-03-06"
---

## What changed
- Added a shared `SafeImage` wrapper for listing media that bypasses Next image optimisation for Supabase-hosted URLs.
- Migrated `/home` dashboard listing cards to `SafeImage` so Supabase images load directly instead of routing through `/_next/image`.
- Kept existing card layouts and interactions unchanged while adding a consistent loading skeleton and fallback label for failed media.

## Rollback plan
- Revert commit `fix(media): use SafeImage on dashboard to prevent Supabase optimiser blanks`.
- If urgent, restore prior behaviour by reverting `SafeImage` usage in host dashboard card components only.
