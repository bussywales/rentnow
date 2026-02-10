---
title: "Phase 2: Tier visibility, leaderboard, and Agent Help Centre"
audiences: [ADMIN, HOST, AGENT]
areas: [referrals, help, dashboard, admin]
cta_href: "/dashboard/referrals"
published_at: "2026-02-10"
source_ref: "codex/phase2-tier-leaderboard-agent-help"
---

We shipped a status-layer upgrade for referrals and a new Agent Help Centre with publishable Help articles.

## What shipped
- New role-aware Help drawer in the header:
  - Admin sees admin docs shortcuts.
  - Agents/Hosts see a Help Centre drawer with curated sections and fast links to Referrals and all articles.
- New Agent Help Centre at `/help/agents` with sticky category nav, start-here guidance, common tasks, and escalation checklist.
- New Help Articles system:
  - Content lives in `web/content/help/*.mdx`.
  - Article routes:
    - `/help/articles`
    - `/help/articles/[slug]`
    - `/help/agents/articles/[slug]`
  - Supports `<Callout />`, `<Steps />`, `<YouTube />`, and `<Image />` components.
  - Includes 8 starter articles.
- Referrals status layer improvements:
  - Dedicated leaderboard API: `GET /api/referrals/leaderboard`.
  - Full leaderboard page: `/dashboard/referrals/leaderboard` (Top 50 + personal rank callout).
  - Dashboard leaderboard card now links to the full leaderboard and includes “how to climb” guidance.
- Admin referral controls expanded:
  - Leaderboard scope setting (currently global behavior).
  - Privacy default toggle for initials-only display.
  - Referral settings quick link added to Admin control panel.

## How to add a new Help article
1. Add an `.mdx` file under `web/content/help/` using kebab-case filename (this becomes the slug).
2. Include frontmatter: `title`, `description`, `role`, `category`, `order`, `tags`, `updatedAt`.
3. Add images to `web/public/help/` and reference with `/help/<filename>`.
4. Embed video with `<YouTube id="VIDEO_ID" title="..." />`.
5. Run lint, tests, and build before merging.

## How to toggle leaderboard
1. Open `Admin > Settings > Referrals`.
2. In **Leaderboard controls**, set:
   - Enable leaderboard
   - Public visibility
   - Monthly/All-time windows
   - Initials-only privacy default
   - Scope (global for now)
3. Save settings and verify via `Leaderboard preview` link.
