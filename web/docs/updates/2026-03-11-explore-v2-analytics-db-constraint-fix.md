---
title: "Explore V2 analytics DB constraint fix"
audiences: [TENANT, HOST, ADMIN]
areas: [analytics, explore-v2, database]
published_at: "2026-03-11"
---

## What was broken
- Explore V2 analytics events were fired by clients and accepted by API validation, but database inserts failed on `explore_events_event_name_check`.
- This prevented Explore V2 conversion events from being stored, so `/admin/analytics/explore-v2` stayed at zero.

## What changed
- Added a new migration to replace `explore_events_event_name_check` with the full current ingest allowlist, including all Explore V2 event names.
- Centralized ingest event names in a shared constant used by the analytics ingest API.
- Added contract coverage to ensure the migration constraint list includes every API-allowed event name.
- Expanded ingest tests to verify all Explore V2 event names are accepted in ingest assumptions.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
- If needed, ship a follow-up migration that restores the previous constraint list.
