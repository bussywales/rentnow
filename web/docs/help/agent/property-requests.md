---
title: "Agent property requests"
description: "Use the request board to find active demand and respond with managed listings."
order: 25
updated_at: "2026-03-16"
---

## What this feature is for

Property Requests gives agents a private demand board for matching active seeker needs with listings they manage.

Use it to surface structured demand without exposing seeker contact details or turning the workflow into a public feed.

## Where to access it

- Use the `Property Requests` link in the workspace sidebar while you are on agent workspace routes such as `/home`, `/host`, `/profile`, or `/account/verification`.
- The sidebar link opens `/requests`.

## Routes you can use

- `/requests` opens the request discovery board for agent accounts.
- `/requests/[id]` opens the read-only request detail and response composer.

Agents do not use the tenant request creation routes.

## Browse and filter requests

From `/requests` you can filter by:

- intent
- market
- city or area search
- property type
- bedrooms
- move timeline
- budget range

Only requests that are `open`, published, and not expired are visible to agents.

## Open a request and inspect fit

The request detail page shows:

- location summary
- budget range
- property type, bedrooms, and bathrooms preferences
- move timeline
- furnishing preference
- optional notes
- expiry context

Seeker contact details are intentionally hidden in this phase.

## Send matching listings

Use `Send matching listings` on `/requests/[id]`.

Responder constraints:

- select up to 3 eligible listings
- only listings you own or actively manage are allowed
- only valid live inventory can be sent
- include an optional short note if it helps explain fit
- already-sent listings are marked and cannot be resent to the same request

## Response privacy rules

- seekers only see the listings and your optional note
- you can only see your own sent responses on that request
- other responders remain private
- direct contact sharing is not part of this workflow

## What you cannot do

- view draft or expired seeker demand as a responder
- send another advertiser's listings
- see other responders' private response content
- start a negotiation thread or chat here yet

## Related guides

- [Agent core workflows](/help/agent/core-workflows)
- [Agent getting started](/help/agent/getting-started)
