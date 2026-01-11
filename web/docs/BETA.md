# Beta Verification & Guardrails

## Purpose
This doc captures beta-facing guardrails, expected behaviors, and quick checks for common support issues.
It does not add new features; it documents what the product already does.

## Tooling requirement
- Node.js >= 20.9.0 (recommended: 20.9.0).
- npm version follows the Node install.
- Example:
  - `nvm install 20.9.0`
  - `nvm use 20.9.0`
- Troubleshooting: If `npm ci` fails with `@supabase/ssr` undefined, you are likely on an old Node (e.g. v14).

## Release Discipline (Beta)
- Work only from the beta branch (`feat/r6.7`).
- Run validations before tagging: `npm ci`, `npm run lint`, `npm run build`, `npm test`.
- Tag the release after validations pass and push tags: `git tag <tag>` → `git push --tags`.
- Deploy by tag (never by branch head).

### Pre-tag verification
- `/admin/support` loads and shows expected diagnostics.
- `/admin/alerts` loads and shows current alert state.
- Listings flow works end-to-end (Basics → Details → Photos → Preview → Submit).
- Browse shows listings or a clean empty state (no diagnostics in production).

### Post-deploy verification
- Run the Beta Smoke Checklist below.
- Confirm the deployed tag matches the intended release.
- Check error logs for auth or Supabase configuration warnings.

## Beta Smoke Checklist
Use this alongside the full QA checklist at `web/docs/qa/checklist.md`.

### Personas
- Tenant (logged out)
- Tenant (logged in)
- Landlord/Agent (logged in)
- Admin (logged in)

### Key routes to verify
- `/properties` (Browse)
- `/properties/[id]`
- `/dashboard`
- `/dashboard/analytics`
- `/admin/support`
- `/admin/alerts`

### Listings (host flow)
- Basics → Details → Photos → Preview → Submit works without silent failures.
- If required Basics fields are missing, the stepper shows a clear message and blocks Next.
- Photos step while logged in stays authenticated on refresh and direct URL open.
- Logged-out users are redirected to `/auth/login?reason=auth&next=...`.

### Browse → Detail → Save Search
- Browse shows listings or a clean empty state (no diagnostics in production).
- Detail page loads without raw errors; missing listings show a friendly message + CTA back to browse.
- Save search is tenant-only; non-tenants see a role-aware message.

### Messaging
- Blocked messaging states show a reason + CTA (no raw 401/403 in UI).
- Rate-limited sends show a retry countdown (if enabled).

### Admin support
- `/admin/support` and `/admin/alerts` render with read-only data.
- “Not tracked / Not available” appears where durable metrics do not exist.
- `/admin/analytics` shows the demand funnel card with clear drop-off copy.

## Known Beta Limitations
- Some metrics (e.g., invalid share token attempts) are not tracked in the DB; use logs for visibility.
- Missing-photos metrics depend on `public.property_images` joins; if unavailable, the UI reports “Not available”.
- Push alerts require VAPID envs; without them, push is “Unavailable (not configured)”.
- Demand funnel signals rely on `property_views`, `saved_properties`, `messages`, and `viewing_requests`; anonymous views are not deduped.

## Stop-Ship Conditions
- Listings cannot be created or saved due to auth/session failures.
- Browse shows “Unable to load listings” for all users.
- Photos upload fails for all hosts (not a single-user issue).
- Admin support dashboards error consistently or show blank snapshots.
- Migrations are mismatched (missing columns/functions) or schema drift breaks core flows.
- Admin telemetry is missing for core tables (properties, property_images, messages, viewing_requests).

## Troubleshooting

### Listings won’t load in Browse
- Confirm `/api/properties` returns data with a 200 response.
- Check `NEXT_PUBLIC_SITE_URL` and Supabase env vars are set in the deploy.
- If empty state persists with known listings, verify `is_active` and `is_approved` on the listing rows.

### “Listing not found” in dashboard edit
- Re-open the listing from the dashboard (bad URLs are rejected).
- Confirm the user owns the listing or is an admin.

### Photos step prompts login despite being logged in
- Verify session cookies are present for the domain.
- Hard refresh the Photos step; it should remain authenticated.
- If the problem persists, inspect `NEXT_PUBLIC_SITE_URL` and Supabase auth cookie domain settings.

### How to verify migrations are applied
- Run `npx supabase@latest migration list` and confirm recent versions are marked as applied.
- If you must validate via CLI, run `npx supabase@latest db push` and confirm there are no pending migrations.
- Spot-check critical columns/functions via SQL in Supabase if needed (e.g., `country_code` on `public.properties`).

### Save search blocked
- Tenants only; landlord/agent/admin should receive `role_not_allowed` messaging.
- Free tenant limits should return `limit_reached` with upgrade CTA.

### Push alerts not delivering
- Confirm VAPID keys are set and push subscriptions exist in `public.push_subscriptions`.
- If push is unavailable, the UI should say “Unavailable (not configured)”.

## Rollback & Triage

### Triage first
1. Check `/admin/support` and `/admin/alerts` for errors or missing telemetry.
2. Check `/api/debug/env` for missing env vars.
3. Confirm `/api/properties` returns results for a public user.

### Rollback
- Identify the last known-good tag in `docs/RELEASES.md` or `web/docs/VERSIONS.md`.
- Redeploy the previous tag in the hosting platform.
- Re-run the Beta Smoke Checklist to confirm recovery.

### Optional subsystem toggles
- If push causes noise, disable it by removing VAPID keys (push becomes “Unavailable” but core flows continue).

## Support Notes
- Avoid sharing raw error text with users; use the UI messages as the source of truth.
- For deeper diagnostics, check server logs in the deployment platform.
