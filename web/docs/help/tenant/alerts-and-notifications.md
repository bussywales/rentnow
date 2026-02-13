---
title: "Tenant alerts and notifications"
description: "How saved-search alerts work, when emails send, and how to avoid noisy inboxes."
order: 30
updated_at: "2026-02-13"
---

## Alert channels in v1

- In-app saved-search modules on `/tenant/home`.
- Email digests for active saved searches when enabled by ops.
- Role-safe links back to exact matches.

## Frequency behaviour

- Instant: near-real-time, rate-limited.
- Daily: summary of new matches since last send.
- Weekly: wider digest for slower-moving searches.

## How to keep alerts useful

1. Keep search radius and budget realistic.
2. Disable searches that are too broad.
3. Rename searches so digest sections are immediately clear.
4. Review and pause stale searches monthly.

## Disable alerts safely

- Use saved-search settings in app.
- Email digests include a disable link per search.
- If you disabled by mistake, re-enable from saved searches manager.

## Common confusion

- “Why no email today?”
  - No new matches since your last baseline.
  - Alerts may be paused or globally disabled by ops.
- “Why many emails?”
  - Multiple active high-volume searches.
  - Frequency set to instant for broad filters.

## Related guides

- [Tenant core workflows](/help/tenant/core-workflows)
- [Tenant success tips](/help/tenant/success-tips)
