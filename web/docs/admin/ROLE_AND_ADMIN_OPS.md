# Role & Admin Ops (RentNow)

## Overview
This runbook covers how to manage user roles safely, how roles are validated end-to-end, and how to recover from role-related issues.

Roles are a core access control primitive. All changes must be made via admin-only paths and leave an audit trail.

## Allowed roles (source of truth)
These are the only roles the app accepts:
- tenant
- landlord
- agent
- admin

Sources:
- App type definition: `web/lib/types.ts` (`UserRole` union)
- App constant used by validation/UI: `web/lib/roles.ts` (`ROLE_VALUES`)
- Admin API validation: `web/app/api/admin/users/role/route.ts` (zod enum using `ROLE_VALUES`)
- DB enum (initial schema): `web/supabase/schema.sql` (`CREATE TYPE user_role AS ENUM ('tenant','landlord','agent','admin')`)
- DB enum update (agent add): `web/supabase/migrations/004_profile_onboarding.sql`

Status: DB and app are aligned. If you see any other value in `profiles.role`, treat it as invalid and reset to `tenant` (or set to `NULL` and keep onboarding incomplete if the user has not chosen a role yet).

## What “Incomplete” means
The app treats a profile as incomplete when either:
- `profiles.onboarding_completed = false`, or
- `profiles.role` is null/invalid.

This avoids showing a misleading default role before onboarding is finished.

## Profile auto-creation (auth trigger)
The database now auto-creates a `public.profiles` row for every new `auth.users` record.
This prevents Admin from seeing "missing profile" rows after sign-up and ensures the onboarding
state is explicit from day one.

If you still see **Profile missing** in Admin, apply:
- `web/supabase/migrations/026_profiles_autocreate_trigger.sql`

## Trust markers (read-only in UI)
Trust markers provide lightweight credibility signals for listings. They do **not** block messaging or listings.

Fields stored on `public.profiles`:
- `email_verified` (boolean, default false)
- `phone_verified` (boolean, default false)
- `bank_verified` (boolean, default false)
- `reliability_power` (text: excellent|good|fair|poor)
- `reliability_water` (text: excellent|good|fair|poor)
- `reliability_internet` (text: excellent|good|fair|poor)
- `trust_updated_at` (timestamp)

Permissions:
- Users can read their own trust markers (via existing profile select policy).
- Users cannot update verification booleans; updates require admin/service role.
- Admin UI is read-only for trust markers in this phase.
- Trust badges for property viewers read from `public.get_profiles_trust_public(...)` (granted to `anon`) to avoid widening `profiles` RLS.

Quick SQL check (admin/service role):
```sql
select id, role, email_verified, phone_verified, bank_verified,
       reliability_power, reliability_water, reliability_internet, trust_updated_at
from public.profiles
where role in ('landlord', 'agent')
order by trust_updated_at desc nulls last
limit 50;
```

## Admin UI: Promote/Demote a user
Path: `Admin → Users` (`/admin/users`)

Steps:
1) Locate the user.
2) Under **Role management**, pick the new role.
3) Enter a **reason** (required).
4) Click **Save role**.

Expected outcomes:
- Role is updated in `public.profiles.role`.
- `profiles.onboarding_completed` is set to true (admin override completes onboarding).
- An audit row is written in `public.role_change_audit`.
- The UI confirms success.

Notes:
- The action is admin-only and requires the service role env to be set. If it is missing, the API returns `503`.

## Admin API: Change role programmatically
Endpoint (admin-only):
- `POST /api/admin/users/role`

Request body:
```json
{
  "profileId": "<uuid>",
  "role": "tenant|landlord|agent|admin",
  "reason": "<required reason>"
}
```

Responses:
- `200 { ok: true }` on success
- `200 { ok: true, status: "no_change" }` when role is unchanged
- `400 { error: "Invalid payload." }`
- `403` if not admin
- `503` if service role key missing

## Admin API: List users
Endpoint (admin-only):
- `GET /api/admin/users`

Responses:
- `200 { users: [...] }` on success
- `403` if not admin
- `503` if service role key missing

## Emergency SQL (lockout recovery only)
Use only if no admin can access the UI/API. Execute in Supabase SQL editor.

1) Force a known role and mark onboarding complete:
```sql
UPDATE public.profiles
SET role = 'admin',
    onboarding_completed = true,
    onboarding_completed_at = NOW()
WHERE id = '<profile_id>';
```

2) Optional audit insert:
```sql
INSERT INTO public.role_change_audit (
  target_profile_id,
  actor_profile_id,
  old_role,
  new_role,
  reason
) VALUES (
  '<target_profile_id>',
  '<actor_profile_id>',
  '<old_role_or_null>',
  'admin',
  'emergency recovery'
);
```

## Verification checklist
SQL:
```sql
-- Check for unexpected roles
SELECT role, COUNT(*)
FROM public.profiles
GROUP BY role
ORDER BY role;

-- Check onboarding completion
SELECT onboarding_completed, COUNT(*)
FROM public.profiles
GROUP BY onboarding_completed
ORDER BY onboarding_completed;

-- Ensure audit trail is writing
SELECT COUNT(*) AS audit_rows
FROM public.role_change_audit;
```

App checks:
- `/api/debug/rls` returns `ok:true` for admin and `401/403` for non-admin.
- `/api/admin/users` returns `403` for non-admin and `200` for admin when service role env is set.
- A role change in `/admin/users` creates a new row in `role_change_audit`.

## Common issues
- **"Unknown" or missing role in UI**:
  - Cause: `profiles.role` is null/invalid, or onboarding not completed.
  - Fix: set role and mark onboarding complete via Admin UI; the UI labels incomplete profiles as “Incomplete” and redirects to `/onboarding`.

- **Role changes fail with 503**:
  - Cause: service role env missing.
  - Fix: ensure `SUPABASE_SERVICE_ROLE_KEY` is configured server-side.

- **User stuck in onboarding**:
  - Cause: role not set/invalid, or onboarding_completed still false.
  - Fix: set role via admin UI (with reason), or use emergency SQL to set onboarding_completed true.

## Migration reference
- `web/supabase/migrations/024_admin_role_management.sql`
  - Sets default role to `tenant`
  - Backfills invalid/null roles
  - Adds `role_change_audit` table + RLS
- `web/supabase/migrations/025_profiles_onboarding_state.sql`
  - Adds onboarding completion fields
  - Backfills onboarding state for existing users
