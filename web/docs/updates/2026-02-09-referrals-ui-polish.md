---
title: "Referral UI polish + admin simulator"
audiences:
  - ADMIN
  - HOST
  - AGENT
areas:
  - Referrals
  - Dashboard
  - Admin
cta_href: "/dashboard/referrals"
---
What changed:
- Upgraded `/dashboard/referrals` with a premium referral UX: hero share block, richer metrics, tier progress, collapsible level tree, recent activity feed, and a guided empty state.
- Improved `/admin/settings/referrals` usability with grouped controls, inline guidance, and client-side validation guardrails.
- Added a new admin-only planning tool at `/admin/referrals/simulator` to estimate monthly referral reward issuance and cost under configurable assumptions.

Important:
- Reward issuance logic is unchanged. Rewards are still issued only on verified paid events (for example, verified paid listings/subscriptions) using existing referral logic and settings.
