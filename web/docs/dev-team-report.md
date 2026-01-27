# Dev Team Report — Admin Review Hardening (living note)

## Quick pointers requested by platform architect
- Contract constants: `web/lib/admin/admin-review-contracts.ts`
- Contract tests: `web/tests/unit/admin-review-contracts.test.ts`

## Notes
- Keep the schema allowlists in `web/lib/admin/admin-review-schema-allowlist.ts` aligned with Supabase schema to avoid drift.
- CI guards: contract tests run under `npm test` (see TAP output for contract/allowlist checks).
- Error handling: `/admin/review` now surfaces an error panel when `serviceAttempted && !serviceOk` instead of showing an empty list.
