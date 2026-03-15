---
title: "Living product and engineering roadmap"
audiences: [ADMIN]
areas: [docs, roadmap, ops]
---

- Added a canonical in-repo roadmap at `docs/product/ROADMAP.md` covering:
  - current platform state
  - recently shipped capabilities
  - immediate and next priorities
  - active experiments
  - marketplace quality and admin ops roadmap
  - stability guardrails and fragile areas
- Reduced `docs/ROADMAP.md` to a legacy pointer so future sessions and humans do not rely on stale roadmap copies.
- Updated the main README roadmap link to point to the canonical roadmap.

Why this matters:

- Future Codex sessions should not need chat history to understand current direction, operating rules, or fragile surfaces.
- The roadmap now captures release discipline explicitly, including double-green go-live and remote Supabase migration requirements.

Rollback:

- Revert this commit to restore the previous roadmap pointers and remove the new canonical roadmap doc.
