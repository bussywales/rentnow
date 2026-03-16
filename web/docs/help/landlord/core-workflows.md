---
title: "Landlord core workflows"
description: "Listing lifecycle, quality controls, demand capture, and property request response operations."
order: 20
updated_at: "2026-03-16"
---

## Listing lifecycle

1. Draft listing with complete essentials.
2. Submit for approval.
3. Activate and monitor enquiries.
4. Refresh content regularly (media + description quality).

## Quality controls before publish

- Minimum photo count and clear hero image.
- Description depth: amenities, fees, restrictions, nearby context.
- Accurate pricing and period fields.
- Precise location and availability signals.

## Listing quality workflow in the editor

- Use `/host/properties/[id]/edit` to improve weak listings before submit.
- The editor now surfaces step-specific quality nudges where the fix belongs:
  - `Photos` for cover image and minimum images
  - `Details` for title and description quality
  - `Basics` for price and location gaps
- On the submit step, look for:
  - `Listing quality`
  - `Best next fix`
  - jump-back actions such as `Go to Basics`, `Go to Details`, or `Go to Photos`

These are guidance cues, not hard publish blocks.

## Demand capture workflow

- Use market hubs and discovery rails to identify demand locations.
- Keep one featured candidate listing per key location cluster.
- Track message response speed and viewing follow-through.

## Property requests workflow

- Use the workspace sidebar `Property Requests` entry, or open `/requests`, to browse eligible seeker demand.
- Filter by intent, market, bedrooms, move timeline, and budget before responding.
- Open `/requests/[id]` to inspect the brief and send up to 3 matching listings you own or manage.
- Use this workflow for platform-mediated matching only; contact details stay private in this phase.

## Property request alerts

- New published requests can trigger email alerts to responder-side users with matching live supply in the same market.
- Use `/profile` to manage `Email me when a new property request is published in my market`.
- The alert is relevance-filtered; it is not sent for every request on the platform.

## Host featured strip workflow

- Open `/host?view=all` to review the Featured strip above the media mosaic.
- The strip prioritizes active featured listings and caps to six cards for quick triage.
- Use the strip for top-of-day checks, then continue in the full mosaic for bulk actions.
- Use horizontal swipe/trackpad scroll in the strip to peek adjacent spotlight cards before deep review.

## Canonical listing management routes

- Use `/host/listings` as the primary management surface for all inventory.
- Use `/host/properties/[id]/availability` for availability controls.
- Use `/host/shortlets/[id]/settings` for shortlet-specific setup.
- In feed cards, use the primary `Manage` button for editing and the `...` menu for secondary actions.

## Demo vs real inventory

- Demo listings are for sandbox/training only.
- Do not use demos to represent live availability.
- Production conversion should come from approved, active, real listings.

## Related guides

- [Landlord property requests](/help/landlord/property-requests)
- [Landlord featured and payments](/help/landlord/featured-and-payments)
- [Landlord troubleshooting](/help/landlord/troubleshooting)
