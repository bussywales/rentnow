---
title: "Admin troubleshooting"
description: "Fast checks for import errors, queue issues, reconcile failures, and alerts incidents."
order: 40
updated_at: "2026-02-13"
---

## Product updates import fails

- Confirm notes are in `web/docs/updates/*.md`.
- Validate required frontmatter: `title`, `audiences`, `areas`.
- Check invalid notes list for parser failures.
- Run sync/import again after fixing files.

## Featured queue inconsistencies

- Confirm request status transitions are valid (pending -> approved/rejected/cancelled).
- Check stale flag behaviour (>14 days) and rejection reason.
- Verify featured fields on property after approval + activation path.

## Payment activation delayed

1. Verify webhook event exists for reference.
2. Run reconcile by reference.
3. Confirm payment status and featured purchase status.
4. Confirm receipt dedupe flag behavior.

## Alerts run issues

- Verify Resend domain configuration and sender domain.
- Confirm alerts toggle and kill switch states.
- Check last-run status JSON for disabled reason and failure count.

## Minimum escalation payload

- request ID/reference,
- actor/user ID,
- route,
- UTC timestamp,
- concise reproduction steps,
- screenshot without secrets.
