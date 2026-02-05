# Codex release notes enforcement

Every user-visible change must include a Product Updates note so teams and customers see what shipped.

## Required workflow

1) Add a markdown update note under `web/docs/updates/`.
2) Include YAML frontmatter with:
   - `title`
   - `audiences`: array of `ADMIN`, `HOST`, `TENANT`, `AGENT`
   - `areas`: free-text tags (e.g. Listings, Messaging)
   - optional `cta_href`, `published_at`, `source_ref`
3) If a change is not user-visible, add `web/docs/updates/NO_UPDATE.md` with a short justification.

## Role mapping rules

When changes touch role-specific areas, update notes must include the matching audiences:

- **ADMIN**: `web/app/admin/**`, `web/app/api/admin/**`, `web/components/admin/**`, `web/lib/admin/**`
- **HOST**: `web/app/host/**`, `web/app/dashboard/**`, `web/components/host/**`, `web/components/leads/**`
- **TENANT**: `web/app/tenant/**`, `web/app/properties/**`, `web/app/support/**`, `web/components/tenant/**`, `web/components/properties/**`, `web/app/api/properties/**`, `web/app/api/saved-properties/**`
- **AGENT**: `web/app/agents/**`, `web/components/agents/**`, `web/lib/agents/**`, `web/app/api/profile/agent-storefront/**`

If only shared infrastructure is touched (e.g. `web/lib/**`, `web/supabase/**`) and no role-specific paths are changed, a note is still required but no specific audience is enforced.

## Exclusions

These do **not** trigger update notes:

- Tests: `web/tests/**`, `**/*.test.ts`, `**/*.spec.ts`
- Docs: `docs/**`, `web/docs/**` (except `web/docs/updates/**`)
- Snapshots: `web/supabase/schema.sql`, `web/supabase/rls_policies.sql`

The enforcement test runs on every `npm test` and will fail with a clear error if a required audience is missing.
