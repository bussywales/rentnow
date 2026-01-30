# Messaging Ops

## Message states
Messaging uses lightweight, derived states:
- sent: client created the message but it is still in-flight.
- delivered: the server accepted the message and persisted it.
- read: not tracked today (no read receipts).

Delivery means the message was persisted by the server. It does not imply push delivery or read acknowledgement.

## Threaded inbox (dashboard replies)
Messaging is now thread-based for the dashboard inbox:
- `public.message_threads` stores the tenant ↔ host thread per listing.
- `public.messages` remains the post table (each row = one message) and now includes `thread_id`, `sender_role`, and `read_at`.
- Threads are created automatically on the first tenant message and updated on each reply.

### Core columns
- message_threads: `property_id`, `tenant_id`, `host_id`, `subject`, `last_post_at`, `status`
- messages: `thread_id`, `sender_id`, `recipient_id`, `sender_role`, `read_at`, `body`, `created_at`

### RLS summary
- Threads: tenant/host participants can read + update; admins can read.
- Messages: participants can read; sender inserts; recipient updates `read_at`.

## Reason codes (server source of truth)
Messaging restrictions return one of these reason codes:
- not_authenticated: user is signed out (send them to `/auth/login`).
- onboarding_incomplete: profile role not set (send them to `/onboarding`).
- role_not_allowed: non-tenant/host roles cannot send messages.
- property_not_accessible: listing is missing or not live.
- conversation_not_allowed: participants are not the listing host/tenant pair or host tried to start a thread.
- rate_limited: sender hit the short-window throttle (see Rate limiting).
- unknown: service unavailable or unexpected failure.

The UI renders copy based on the reason code and shows the matching CTA.

## Permission rules (server source of truth)
- Tenants can message a listing host (landlord or agent) when the listing is live.
- Landlords and agents can reply after a tenant starts the thread.
- Messaging is only available between a tenant and the listing host.

When blocked, the UI shows a clear reason and an action (login, onboarding, or support).

## Rate limiting
Messaging sends are throttled per sender (and per property when available).
- Defaults: 60 seconds / 6 sends.
- Configurable via env: `MESSAGING_RATE_LIMIT_WINDOW_SECONDS`, `MESSAGING_RATE_LIMIT_MAX_SENDS`.
- UI shows a retry hint with `retry_after_seconds` and a support CTA.
- The cooldown timer is client-side and resets if the user navigates away or reloads the page.

## UX helpers (client-side)
Quick replies:
- Pre-filled buttons insert text into the composer (no auto-send).
- Only shown when the server permission payload allows sending.

Drafts:
- Drafts autosave per thread in localStorage.
- Key format: `rentnow:msg:draft:<threadId>`.
- Drafts restore on load with a clear notice and can be cleared manually.
- Drafts clear on successful send and reset if browser storage is cleared.

Share link (read-only):
- Generates a short-lived, read-only link for a specific tenant/host thread.
- Tokens expire after 7 days and can be rotated or revoked.
- Share view disables sending and shows a read-only notice.
- Share links require a logged-in participant; unauthenticated users are redirected to login.
- Revoked/expired links show a friendly status message instead of raw errors.
- Successful views update `message_thread_shares.last_accessed_at`.
- Non-participants see an invalid link state.
- Invalid token attempts are not tracked in the database. Use Vercel logs to inspect access attempts.
- Example log entry (tokens/URLs are never logged):
  `{"event":"share_access_attempt","result":"invalid","actor_profile_id":"<uuid>","property_id":"<uuid>","ts":"2026-01-20T12:34:56.000Z"}`

## Throttle telemetry (durable)
Rate-limited send attempts are recorded to `public.messaging_throttle_events` for ops visibility.
Captured fields:
- `actor_profile_id`, `thread_key`, `property_id`, `recipient_profile_id`
- `reason_code` (rate_limited only), `retry_after_seconds`, `window_seconds`, `max_sends`
- `mode` (currently `send_message`)

Not captured:
- message body/content
- delivery/read state
- raw IP addresses (no IP stored today)

Verification:
```sql
select count(*)
from public.messaging_throttle_events
where created_at >= now() - interval '24 hours';
```

## Admin observability (read-only)
Admin Support page (`/admin/support`) includes a messaging snapshot:
- Message status counts (sent/delivered/read).
- Message counts per user (sampled).
- Restricted cases derived from current data with reason codes + labels.
- Filters for status (sent/delivered/read/restricted) and reason codes.
- Rate limiting window + throttled counts and top senders.
- Throttle telemetry totals (24h/7d/30d) with top senders/threads (sampled).

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
- Repeated `rate_limited`: ask the user to wait for the window to reset; tune env limits only if necessary.
