---
title: "Referral MVP v1 (configurable multi-level rewards)"
audiences:
  - ADMIN
  - HOST
  - AGENT
areas:
  - Referrals
  - Billing
  - Dashboard
cta_href: "/dashboard/referrals"
---
What changed:
- Added a referral MVP with unique referral codes and a tracked referral tree (up to 5 levels deep).
- Rewards now issue as platform credits (no cash payout) when verified paid events occur: PAYG listing fee and subscription verification.
- Reward behavior is configurable from admin settings, including enabled levels, per-level rule types/amounts, tier thresholds, and daily/monthly caps.
- Added guardrails for immutable historical rewards and idempotent reward insertion by event reference.

How referral rewards work:
- Agent referral links use `/r/[code]` and store a referral cookie for registration attribution.
- On first authenticated onboarding/dashboard visit, the referral code is captured and linked once per user.
- On verified payment events, the system resolves ancestors up to configured depth, applies enabled levels + caps, records reward rows, and grants whole credit units.

Configurable levels:
- Admin can set max depth (1-5), exactly which levels are rewarded, and JSON reward rules per level.
- Default setup rewards level 1 only.

Agent dashboard walkthrough:
- New `/dashboard/referrals` page includes referral link/code, total/direct/indirect referrals, verified referrals, earned/issued/used credits, tier badge with progress, expandable level tree, and recent activity.
- New admin page `/admin/settings/referrals` controls the referral system with live analytics preview.
