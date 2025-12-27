# Supabase Migrations Runbook

This runbook documents how to apply the Supabase migrations in a repeatable way.

## Migration Order

Apply SQL files in this order:
1) `web/supabase/migrations/001_profiles_id_alignment.sql`
2) `web/supabase/migrations/002_core_schema.sql`
3) `web/supabase/migrations/003_rls_policies.sql`
4) `web/supabase/migrations/004_profile_onboarding.sql`
5) `web/supabase/migrations/005_property_status_and_details.sql`
6) `web/supabase/migrations/006_saved_searches.sql`
7) `web/supabase/migrations/007_property_images_position.sql`
8) `web/supabase/migrations/008_fix_profiles_rls_recursion.sql`
9) `web/supabase/migrations/009_properties_workflow_columns.sql`
10) `web/supabase/migrations/010_property_images_position.sql`

Each migration is idempotent and can be re-run safely.

If you see `column properties.status does not exist`, apply:
- `web/supabase/migrations/009_properties_workflow_columns.sql`

## Profiles preflight (id-based)

This project uses `public.profiles.id` as the auth.users FK and does not have `user_id`.

Confirm the schema with:
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
```

Expected columns: `id`, `role`, `full_name`, `phone`, `city`, `avatar_url`, `created_at`.

Admin profile reads are gated by a JWT claim (`role=admin`) or `service_role`. Apply
`008_fix_profiles_rls_recursion.sql` after the base policies to avoid recursive RLS.

## Apply via Supabase SQL Editor

1) Open your Supabase project SQL editor.
2) Paste and run each migration in order (from the repo paths above).
3) Verify using the checks in the next section.

## Apply via Supabase CLI (preferred when configured)

If the project has Supabase CLI configured:
```bash
supabase status
supabase db push
```

If using migration files directly:
```bash
supabase migration up
```

If the CLI is not configured for this repo, use the SQL editor method.

## Verification Checklist

### Tables exist
```sql
select to_regclass('public.properties') as properties;
select to_regclass('public.property_images') as property_images;
select to_regclass('public.saved_properties') as saved_properties;
select to_regclass('public.messages') as messages;
select to_regclass('public.viewing_requests') as viewing_requests;
```

### RLS enabled
```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in (
  'profiles',
  'properties',
  'property_images',
  'saved_properties',
  'messages',
  'viewing_requests'
);
```

### Policies exist (names only)
```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'properties',
    'property_images',
    'saved_properties',
    'messages',
    'viewing_requests'
  )
order by tablename, policyname;
```

### Required columns exist
```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'properties',
    'property_images',
    'saved_properties',
    'messages',
    'viewing_requests'
  )
  and column_name in (
    'id',
    'user_id',
    'owner_id',
    'tenant_id',
    'property_id',
    'sender_id',
    'recipient_id',
    'is_approved',
    'is_active',
    'status',
    'position'
  )
order by table_name, column_name;
```

### App-side verification (admin only)
- `GET /api/debug/rls` should return `ok: true` with `rls`, `policies`, and `columns` metadata.

## Idempotency Check

To confirm migrations are safe to re-run:
1) Apply `001_profiles_id_alignment.sql`, `002_core_schema.sql`, and `003_rls_policies.sql`.
2) Run them a second time in the same order.
3) The second run must complete with zero errors.

## Rollback Guidance

Rollback depends on the environment and data:
- Policies can be removed safely using `DROP POLICY ...` and RLS can be disabled with:
  - `ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;`
- Dropping tables will delete data. Use only for non-production resets.
- The `profiles.id` alignment is structural; reverting requires dropping constraints/triggers and any dependent FKs.

If you must roll back in production, coordinate with the DBA/architect and perform a full backup first.
