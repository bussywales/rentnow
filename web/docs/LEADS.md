# Leads (Buy Enquiries)

## Purpose
Leads capture buy enquiries without exposing direct contact details. Buyers submit an enquiry, which is routed to the listing owner and mirrored in Messages.

## Lead lifecycle
Statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `CLOSED`.

## Data model
Table: `public.listing_leads`
- `property_id`, `owner_id`, `buyer_id`
- `status`, `intent`
- `budget_min`, `budget_max`, `financing_status`, `timeline`
- `message` (sanitized), `message_original` (only when contact exchange mode is `off`)
- `thread_id` (messages thread)

## Safety
Contact exchange protection is applied server-side using the global setting `contact_exchange_mode`:
`off` | `redact` | `block`.

## Routing
- Tenant submits via “Enquire to buy” on BUY listings.
- Host/agent views in `/dashboard/leads`.
- Admin read-only view at `/admin/leads`.
