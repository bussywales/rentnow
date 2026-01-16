# Availability Windows (R16.4a)

Property availability is authored in local property time and exposed to tenants as precomputed slots.

## Data model
- `property_availability_rules`: weekly recurring windows in minutes since midnight (0–1440), per `day_of_week` (0 = Sunday).
- `property_availability_exceptions`: date-specific overrides. `exception_type` is `blackout` (remove all or part of a day) or `add_window` (add a window). Times are in minutes since midnight on `local_date`.
- Both tables enforce RLS: only the property owner can read/write.

## Slot generation
- Inputs: propertyId, `date` (YYYY-MM-DD), property `timezone`.
- Base window: 06:00–22:00 local when no rules exist.
- Rules define windows for that weekday; exceptions remove (`blackout`) or add (`add_window`) windows. Windows outside 06:00–22:00 are rejected.
- Slots are emitted every 30 minutes, converted from property local time to UTC ISO for transport; the response also includes the local label.

## Tenant-facing API
- `GET /api/availability/slots?propertyId=...&date=YYYY-MM-DD`
  - Returns `{ ok: true, timeZone, slots: [{ utc, local }] }`.
  - Requires property to be active/approved.

## Viewing request validation
- `/api/viewings/request` normalizes preferred times and checks that every submitted time is an allowed slot for that property/date in the property timezone. Legacy payloads are bridged and validated against the same availability windows.

## Future (not in this slice)
- Host UI to author rules/exceptions.
- Booking/confirmation flow.
- No-show/trust signals.

## Host editor (R16.4b)
- Host-only route: `/host/properties/[id]/availability`.
- Weekly editor: per-day windows (06:00–22:00, up to 3 windows) with 30/60m slot length selector.
- Exceptions: blackout or extra availability on specific dates (same window constraints).
- Preview: uses `/api/availability/slots` to show tenant-facing slots in property timezone.
- Seed: “Create default schedule” seeds Mon–Fri 09:00–17:00, Sat 10:00–14:00, Sun off.

## Host decisions (R16.4c)
- Host inbox: `/host/viewings` lists requests for owned properties.
- Actions: approve (choose tenant slot), propose new slots (validated against availability), decline with reason.
- Validation uses property availability slots (property timezone) to prevent invalid proposals.
- Tenant UI reflects statuses (requested/approved/proposed/declined) without exposing raw IDs.
