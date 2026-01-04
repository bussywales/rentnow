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

Status: DB and app are aligned. If you see any other value in `profiles.role`, treat it as invalid and reset to `tenant`.

## Admin UI: Promote/Demote a user
Path: `Admin → Users` (`/admin/users`)

Steps:
1) Locate the user.
2) Under **Role management**, pick the new role.
3) Enter a **reason** (required).
4) Click **Save role**.

Expected outcomes:
- Role is updated in `public.profiles.role`.
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

## Emergency SQL (lockout recovery only)
Use only if no admin can access the UI/API. Execute in Supabase SQL editor.

1) Force a known role:
```sql
UPDATE public.profiles
SET role = 'admin'
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

-- Ensure audit trail is writing
SELECT COUNT(*) AS audit_rows
FROM public.role_change_audit;
```

App checks:
- `/api/debug/rls` returns `ok:true` for admin and `401/403` for non-admin.
- A role change in `/admin/users` creates a new row in `role_change_audit`.

## Common issues
- **"Unknown" or missing role in UI**:
  - Cause: `profiles.role` is null/invalid.
  - Fix: set role to `tenant` or the intended value; the UI now labels invalid roles as “Incomplete” and redirects to `/onboarding`.

- **Role changes fail with 503**:
  - Cause: service role env missing.
  - Fix: ensure `SUPABASE_SERVICE_ROLE_KEY` is configured server-side.

- **User stuck in onboarding**:
  - Cause: role not set or invalid.
  - Fix: set role via admin UI or emergency SQL, then re-login.

## Migration reference
- `web/supabase/migrations/024_admin_role_management.sql`
  - Sets default role to `tenant`
  - Backfills invalid/null roles
  - Adds `role_change_audit` table + RLS

