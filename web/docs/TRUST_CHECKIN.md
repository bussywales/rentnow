# Property Check-in Verification (R16.7d.1)

## What it is
- Hosts/agents/admins can record a privacy-safe check-in against a property pin.
- Only a distance bucket is stored (`onsite`, `near`, `far`) plus timestamp and verifier role/id.
- No raw GPS coordinates are stored or exposed to tenants.

## Data model
- Table: `public.property_checkins` (append-only)
  - `property_id`, `created_at`, `distance_bucket`, `method`, `accuracy_m` (optional), `verified_by`, `role`, `note`
- RLS: only owners/active agents/admins can insert/select; tenants cannot read.
- Admin route can insert a `cleared` entry to nullify the latest check-in.

## APIs
- `POST /api/properties/[id]/check-in`
  - Auth: admin/landlord/agent (with delegation)
  - Body: `{ lat, lng, accuracy_m? }`
  - Server computes distance to property pin and stores bucket; returns `{ ok, bucket, checkedInAt }`.
  - Returns `pin_required` if property has no latitude/longitude.
- `POST /api/properties/[id]/check-in/clear`
  - Auth: admin only; records a cleared entry.

## Tenant-facing signal (flagged)
- App setting `show_tenant_checkin_badge` (default false).
- Property responses include `checkin_signal` derived from the latest entry:
  - Status: `recent_checkin` / `stale_checkin` / `none` / `hidden`
  - Bucket and timestamp only; no coordinates.
- Tenant UI shows a subtle badge (“Host checked in recently”) only when the flag is enabled and the latest check-in is recent.

## Host/admin UI (R16.7d.2)
- Listing edit page includes a “Check in at this property” card (landlord/agent/admin):
  - Uses browser geolocation and calls `/api/properties/:id/check-in`.
  - Disabled if no pinned area.
  - Helper text: “Records a privacy-safe signal. We don’t store GPS coordinates.”
- Admin settings UI (/admin/settings) includes toggle:
  - Title: “Tenant check-in badge”
  - Description: “Show a small ‘checked in recently’ indicator to tenants. No GPS coordinates are shown.”

## Privacy guarantees
- No raw host coordinates persisted beyond the request lifetime.
- Tenants see only a coarse, flag-gated signal when enabled.

## Ops
- Flip tenant badge via SQL:
```
update public.app_settings
set value='{"enabled":true}'::jsonb, updated_at=now()
where key='show_tenant_checkin_badge';
```
