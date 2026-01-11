# Beta Verification & Guardrails

## Purpose
This doc captures beta-facing guardrails, expected behaviors, and quick checks for common support issues.
It does not add new features; it documents what the product already does.

## Beta Smoke Checklist
Use this alongside the full QA checklist at `web/docs/qa/checklist.md`.

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

## Known Beta Limitations
- Some metrics (e.g., invalid share token attempts) are not tracked in the DB; use logs for visibility.
- Missing-photos metrics depend on `public.property_images` joins; if unavailable, the UI reports “Not available”.
- Push alerts require VAPID envs; without them, push is “Unavailable (not configured)”.

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

### Save search blocked
- Tenants only; landlord/agent/admin should receive `role_not_allowed` messaging.
- Free tenant limits should return `limit_reached` with upgrade CTA.

### Push alerts not delivering
- Confirm VAPID keys are set and push subscriptions exist in `public.push_subscriptions`.
- If push is unavailable, the UI should say “Unavailable (not configured)”.

## Support Notes
- Avoid sharing raw error text with users; use the UI messages as the source of truth.
- For deeper diagnostics, check server logs in the deployment platform.
