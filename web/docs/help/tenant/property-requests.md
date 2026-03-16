---
title: "Tenant property requests"
description: "Create, publish, manage, and review private demand briefs as a seeker."
order: 25
updated_at: "2026-03-16"
---

## What this feature is for

Property Requests lets you post a structured demand brief when you want hosts or agents to send relevant listings through PropatyHub.

Use it when you want to describe what you need before you have found the right listing.

## Routes you can use

- `/requests` redirects tenant accounts to `/requests/my`.
- `/requests/my` shows your private request list.
- `/requests/new` creates a new request.
- `/requests/[id]` shows your own request detail, lifecycle actions, and received matches.
- `/requests/[id]/edit` updates your own request.

## Create a request

1. Open `/requests/new`.
2. Complete the structured brief.
3. Save it as a draft first if you are still refining it.
4. Publish it when the request is ready to become visible to eligible responders.

The form currently supports:

- intent: rent, buy, or shortlet
- market, city, area, and location details
- budget minimum and maximum
- property type
- bedrooms and optional bathrooms
- move timeline
- optional furnished preference
- optional shortlet duration
- optional notes or special requirements

## Save draft vs publish

- `Save draft` keeps the request private to you and admins.
- `Publish request` moves the request to `open` and makes it visible to eligible hosts and agents.
- If publish is blocked, complete the missing required fields shown in the error message first.

## Manage your request

Use `/requests/[id]` to manage lifecycle actions:

- `Edit request` updates the brief.
- `Publish request` moves a draft into the open request pool.
- `Pause request` moves an open request back to `draft` so it is hidden again.
- `Close request` ends the request when you no longer need matches.

## View responses received

Your request detail page shows a `Received matches` section when responders send listings.

What you can see:

- the matching listing cards
- the time each response was sent
- any optional note included with the response

What stays private in this phase:

- responder contact details
- other responders' private views
- other seekers' requests and responses

## Privacy and visibility rules

- Other seekers cannot browse or open your request.
- Hosts and agents can only see requests that are `open`, published, and not expired.
- Draft requests stay private.
- Admins can inspect and moderate requests and responses.

## What you cannot do yet

- browse other seekers' demand briefs
- start a direct chat from the request
- expose or collect direct contact details through this workflow

## Related guides

- [Tenant core workflows](/help/tenant/core-workflows)
- [Tenant getting started](/help/tenant/getting-started)
