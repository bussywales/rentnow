---
title: "Landlord property requests"
description: "Browse private demand briefs and send matching listings you manage."
order: 25
updated_at: "2026-03-16"
---

## What this feature is for

Property Requests gives landlords a structured request board showing seeker demand that is open to eligible responders.

Use it to match your live inventory against real demand without exposing seeker contact details.

## Routes you can use

- `/requests` opens the request discovery board for landlord accounts.
- `/requests/[id]` opens a read-only request detail view with the response composer.

Landlords do not use seeker-only request creation routes.

## Browse the request board

Open `/requests` to:

- filter by intent
- filter by market
- search by city or area
- narrow by property type, bedrooms, move timeline, and budget range

Only eligible requests appear here:

- `open`
- published
- not expired

## Review a request

Open `/requests/[id]` to inspect:

- budget range
- property type and bedrooms
- move timeline
- furnishing preference
- shortlet duration when relevant
- notes and special requirements
- publish and expiry timing

Seeker identity and direct contact details remain private in this phase.

## Send matching listings

Use `Send matching listings` on the request detail page.

Current responder rules:

- you can send up to 3 listings in one response
- listings must be your own or actively managed by you
- listings must be eligible live inventory for the request
- duplicate sends for the same listing are blocked
- you may include a short optional note

## What the seeker can see

The seeker sees:

- the listings you sent
- the time the response was sent
- your optional note

The seeker does not get direct contact details through this workflow.

## What you cannot do

- browse draft or closed seeker requests
- send listings you do not own or manage
- view other responders' private responses
- start a full chat thread from this feature

## Related guides

- [Landlord core workflows](/help/landlord/core-workflows)
- [Landlord getting started](/help/landlord/getting-started)
