---
title: "Troubleshooting playbook"
description: "Cross-role troubleshooting framework for support, ops, and reproducibility."
order: 10
updated_at: "2026-02-13"
---

## Universal triage flow

1. Identify role + route + exact UTC timestamp.
2. Capture reproducible steps and expected vs actual behaviour.
3. Gather IDs (user, listing, request, payment/reference).
4. Confirm feature toggles and environment signals.
5. Escalate with evidence bundle, not summaries only.

## Common failure classes

- Auth/session redirects and role guards.
- Listing visibility constraints (approval/active/demo/expiry).
- Async operations with idempotency or dedupe behaviour.
- Email delivery constraints and sender-domain issues.

## Evidence standards

- Include screenshot/video where useful.
- Include URL + params for affected page.
- Include exact API error payload when available.
- Never include secrets in logs or screenshots.

## Escalation destinations

- Product behavior mismatch: product + engineering.
- Payments/webhook/reconcile: ops + engineering.
- Messaging/alerts delivery: ops + comms owner.
