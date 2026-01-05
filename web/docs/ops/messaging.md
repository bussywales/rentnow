# Messaging Ops

## Message states
Messaging uses lightweight, derived states:
- sent: client created the message but it is still in-flight.
- delivered: the server accepted the message and persisted it.
- read: not tracked today (no read receipts).

Delivery means the message was persisted by the server. It does not imply push delivery or read acknowledgement.

## Permission rules (server source of truth)
- Tenants can message a listing host (landlord or agent) when the listing is live.
- Landlords and agents can reply after a tenant starts the thread.
- Messaging is only available between a tenant and the listing host.

When blocked, the UI shows a clear reason (for example, listing not live or host cannot start a thread).

## Admin observability (read-only)
Admin Support page (`/admin/support`) includes a messaging snapshot:
- Message status counts (sent/delivered/read).
- Message counts per user (sampled).
- Restricted cases derived from current data.

Notes:
- The snapshot uses the most recent 200 messages.
- Requires `SUPABASE_SERVICE_ROLE_KEY` to be set server-side.
- No admin messaging actions are available here (read-only).

## Troubleshooting
- Missing snapshot: confirm `SUPABASE_SERVICE_ROLE_KEY` is configured.
- Repeated restricted cases: verify profile roles and property ownership for the affected users.
