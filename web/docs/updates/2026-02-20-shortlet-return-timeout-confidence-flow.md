---
title: "Shortlet return page now handles slow confirmations with confidence"
audiences:
  - TENANT
areas:
  - Payments
  - Shortlets
cta_href: "/payments/shortlet/return"
published_at: "2026-02-20"
---

## What changed

- The return page now treats `payment succeeded + booking pending_payment` as a dedicated finalising state.
- At the timeout boundary, the page now performs a final fetch and a short automatic grace recheck before showing timeout guidance.
- Timeout copy now avoids implying payment failure when payment has already succeeded, and the CTA becomes **Recheck now**.

## Why this matters

- Reduces false-alarm timeout experiences during slow booking confirmation windows.
- Gives users clearer confidence that payment is received while confirmation catches up.
