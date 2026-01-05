# Messaging Ops

## Message states
Messaging uses lightweight, derived states:
- sent: client created the message but it is still in-flight.
- delivered: the server accepted the message and persisted it.
- read: not tracked today (no read receipts).

Delivery means the message was persisted by the server. It does not imply push delivery or read acknowledgement.

## Reason codes (server source of truth)
Messaging restrictions return one of these reason codes:
- not_authenticated: user is signed out (send them to `/auth/login`).
- onboarding_incomplete: profile role not set (send them to `/onboarding`).
- role_not_allowed: non-tenant/host roles cannot send messages.
- property_not_accessible: listing is missing or not live.
- conversation_not_allowed: participants are not the listing host/tenant pair or host tried to start a thread.
- rate_limited: only used if an existing limiter is active.
- unknown: service unavailable or unexpected failure.

The UI renders copy based on the reason code and shows the matching CTA.

## Permission rules (server source of truth)
- Tenants can message a listing host (landlord or agent) when the listing is live.
- Landlords and agents can reply after a tenant starts the thread.
- Messaging is only available between a tenant and the listing host.

When blocked, the UI shows a clear reason and an action (login, onboarding, or support).

## Admin observability (read-only)
Admin Support page (`/admin/support`) includes a messaging snapshot:
- Message status counts (sent/delivered/read).
- Message counts per user (sampled).
- Restricted cases derived from current data with reason codes + labels.
- Filters for status (sent/delivered/read/restricted) and reason codes.

Notes:
- The snapshot uses the most recent 200 messages.
- Requires `SUPABASE_SERVICE_ROLE_KEY` to be set server-side.
- No admin messaging actions are available here (read-only).

## Troubleshooting
- Missing snapshot: confirm `SUPABASE_SERVICE_ROLE_KEY` is configured.
- Repeated `onboarding_incomplete`: send the user to `/onboarding`.
- Repeated `not_authenticated`: confirm the user is signed in and session cookies are set.
- Repeated `property_not_accessible`: confirm listing is live and IDs match the listing host.
- Repeated `conversation_not_allowed`: confirm the host is replying to an existing tenant thread.
