---
title: "Supabase migration deployment guardrails"
audiences: [ADMIN, HOST, TENANT]
areas: [ops, database, deployment]
published_at: "2026-03-13"
summary: "Added a remote migration status check, CI guard workflow, and release guidance so schema-backed code cannot ship quietly ahead of Supabase."
---

## What changed

- Added a repo command to compare local Supabase migrations with the linked remote project:
  - `npm --prefix web run db:migrations:status`
- Added a GitHub workflow to run the migration drift check when migration-related files change.
- Updated the go-live and Supabase runbooks with the required status check and the exact deploy command:
  - `cd web && npx supabase@latest db push --include-all`

## Why

- This prevents code/schema drift where application code ships before the required remote migration is applied.
- The guard now fails loudly when local migrations are ahead of the linked remote project or when remote status cannot be verified.

## Rollback

- Revert the guardrail commit if the workflow or status command needs to be removed.
