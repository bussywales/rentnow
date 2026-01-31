# Security Access Matrix

This doc summarizes data access rules for PROPATYHUB (API + RLS). "Published" means `is_approved = true` and `is_active = true`.

## Data Model + API Touchpoints

| Table | Purpose | API routes |
| --- | --- | --- |
| `profiles` | user roles and profile details | `/api/admin/users` (admin), app server queries |
| `properties` | listings | `/api/properties`, `/api/properties/[id]`, `/api/admin/properties/[id]` |
| `property_images` | listing photos | `/api/properties`, `/api/properties/[id]` |
| `saved_properties` | favourites | `/api/saved-properties` |
| `viewing_requests` | viewing scheduling | `/api/viewings` |
| `messages` | property chat threads | `/api/messages` |

## Access Matrix (API + RLS)

| Resource | Public | Tenant | Landlord/Agent | Admin |
| --- | --- | --- | --- | --- |
| Properties (list/detail) | Read published only | Read published only | Read own + published | Read all |
| Properties (create/update/delete) | No | No | Own only | Any |
| Property images | Read published only | Read published only | Own + published | Any |
| Saved properties | No | Own only | Own only | No |
| Viewing requests | No | Create + read/update own | Read/update requests for own properties | Read/update any |
| Messages | No | Read/write only if participant | Read/write only if participant | Read/write any |
| Profiles | No | Read/update self | Read/update self | Read any (admin tools only) |

## API Enforcement Notes

- `/api/properties`:
  - `GET` returns published listings only; `GET?scope=own` requires landlord/agent/admin.
  - `POST` requires landlord/agent/admin.
- `/api/properties/[id]`:
  - `GET` returns published listings publicly; unpublished requires owner/admin.
  - `PUT/DELETE` requires owner/admin.
- `/api/saved-properties`: authenticated user only, scoped to their `user_id`.
- `/api/viewings`: tenant can create; tenant/owner/admin can read/update.
- `/api/messages`: authenticated only; participants (sender/recipient) can read/write; admin can read/write any.
- `/api/admin/*`: admin only.

## RLS Policies

Source of truth: `web/supabase/rls_policies.sql`

Apply in Supabase SQL editor:
1) Open SQL editor and run the contents of `web/supabase/rls_policies.sql`.
2) Verify with `/api/debug/rls` (admin only) or via Supabase table editor policies.
