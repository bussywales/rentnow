# Supabase Security/Performance Hardening Notes

## Advisor follow-ups
- Unindexed foreign keys: added targeted indexes with names `idx_<table>_<column>`.
- Duplicate/unused indexes: Advisor flagged unused indexes, but no exact duplicates were found in-repo. Non-duplicate indexes were retained pending workload analysis to avoid behavior regressions.
- Security definer view: no security-definer views exist in the repo migrations. Security-definer RPCs that expose public trust badges remain in place with explicit column allowlists and role filters.

## Optional dashboard setting
If desired, enable leaked password protection in Supabase:
1. Go to Supabase Dashboard -> Authentication -> Settings.
2. Enable "Leaked password protection".
3. Save changes.
