# Tenant Reliability (No-Show Signal) — R16.5a

Purpose: capture a factual, host-reported no-show signal. It is non-punitive, host-visible only, and time-bounded (90 days). No public badges, no automatic penalties.

Data
- Columns on `viewing_requests`:
  - `no_show_reported_at` TIMESTAMPTZ (nullable)
  - `no_show_reported_by` UUID (nullable, references auth.users)
- Constraints:
  - Can only be set when `status = approved`.
  - Once set, cannot be changed.

API
- `POST /api/viewings/:id/no-show`
  - Owner-only (property owner), approved-only, one-time. Returns `{ ok: true }`.
- Read endpoints `/api/viewings/host` and `/api/viewings/tenant` surface `no_show_reported_at` and a 90-day reliability summary for hosts:
  - `noShowCount90d`
  - `completedCount90d` (currently 0; completion not tracked yet)
  - `label`: Reliable (no no-shows, some completed), Mixed (≥1 no-show), Unknown (no recent data)

UI
- Host can “Mark as no-show” with confirmation copy: “Only mark this if the tenant didn’t attend and didn’t notify you.”
- Tenants see neutral text: “Marked as no-show by host.” No blamey language.
- Host sees “Viewing reliability: <label> (<context>)” for the tenant on that request.
- Tenants can re-request after a decline; property CTA is driven by the latest viewing status (declined/no-show unlocks the button).

Notes
- Signal is host-reported only; no automation or enforcement in this slice.
- Rolling window: 90 days.
