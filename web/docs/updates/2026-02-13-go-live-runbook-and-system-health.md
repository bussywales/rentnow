---
title: "Go-live runbook + admin system health page"
audiences:
  - ADMIN
areas:
  - OPS
  - ADMIN
cta_href: "/admin/system"
published_at: "2026-02-13"
---

## What changed

- Added a one-page launch runbook at `/docs/go-live-checklist.md` for Vercel + Supabase go-live checks.
- Added a new admin health page at `/admin/system` with:
  - server UTC time and build SHA (when available)
  - env presence indicators (Resend, Cron secret, Paystack secret)
  - key launch setting snapshots for alerts, featured, verification, and market defaults
- Added quick links from the health page to `/admin/alerts`, `/admin/payments`, `/admin/settings`, and `/admin/featured/requests`.
