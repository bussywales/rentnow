---
title: "AI support assistant with escalation cues"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Support
  - Help
cta_href: "/support"
published_at: "2026-02-23"
---

## What changed

- Added a support assistant endpoint (`/api/support/assistant`) that grounds responses on help docs retrieval.
- Added a support chat thread inside the global support widget.
- Added deterministic escalation cues for high-risk or low-confidence scenarios so users can escalate faster.

## Who it affects

- Tenant/Host/Agent:
  - Can ask support questions inline and get grounded article suggestions.
  - Sees explicit escalation prompts when the issue needs human review.

## Where to find it

- Site-wide support widget
- `/support`

