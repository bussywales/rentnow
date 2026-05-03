---
title: "Agent core workflows"
description: "Portfolio workflow for listing quality, lead handling, demand capture, and property request response operations."
order: 20
updated_at: "2026-03-21"
---

## Portfolio listing operations

1. Prioritize listings by demand market and quality score.
2. Publish complete, accurate listings only.
3. Use demo flags strictly for non-customer-facing scenarios.
4. Review status/expiry regularly to avoid dead inventory.

## Listing quality workflow in the editor

- Use `/host/properties/[id]/edit` when a listing needs quality cleanup before submit or resubmit.
- The editor now gives step-specific nudges:
  - `Photos` for cover and image count
  - `Details` for stronger title and description quality
  - `Basics` for pricing and location completeness
- The submit step shows `Listing quality` and a `Best next fix` block with jump-back actions so you can fix the highest-impact gap quickly.

These cues help improve conversion and approval readiness, but they do not act as hard publish blocks by themselves.

## Demo listings workflow

- Use demo listings only for sandbox, training, or showcase scenarios that should not behave like live client inventory.
- In the editor, open `Basics` and use `Mark as demo listing` to set the listing as demo.
- After save, the same `is_demo` flag is what admins see in the registry and inspector.

Expected outcome:

- Demo listings follow demo visibility policy rather than normal live-inventory assumptions.
- A `Demo` badge can appear on cards and detail pages when admin settings keep demo badges enabled.
- A `DEMO` watermark can appear on listing images when admin settings keep demo watermarks enabled.
- Demo listings are excluded from featured placement and other promotional/customer-facing highlight surfaces.

Do not treat a demo listing as real, bookable, or promotable inventory.

## Lead and message operations

- Route and respond quickly to high-intent enquiries.
- Keep message quality consistent with clear next steps.
- Track drop-off points and improve first-response scripts.

## Demand capture loop

- Follow high-signal searches for your key markets.
- Compare “new this week”, trending rails, and saved-search signals.
- Adjust listing quality/pricing based on actual match patterns.

## Property requests workflow

- Use the workspace sidebar `Property Requests` entry, or open `/requests`, to browse eligible demand briefs.
- Filter hard before responding so your sent listings fit the brief.
- Use `/requests/[id]` to review requirements and send up to 3 owned or managed listings.
- Keep notes concise; direct contact details are intentionally not part of this workflow.

## Property request alerts

- Agents can receive email alerts when a newly published request matches their saved request-alert criteria in the same market.
- Manage the toggle from `/profile`:
  - `Email me when a new property request is published in my market`
- Alerts are criteria-based and opt-in. They are not a blast to every agent account.

## Host featured strip workflow

- Use `/host?view=all` for a quick Featured strip pass before full portfolio review.
- The strip keeps six spotlight cards visible for faster top-listing checks.
- Use “View all” in the strip to jump directly into the full media mosaic.

## Cross-functional coordination

- Share clear context with admins when escalation is needed.
- Reference listing IDs, request IDs, and timestamps.
- Keep product update notes and help docs in sync with operations.

## Related guides

- [Agent property requests](/help/agent/property-requests)
- [Agent featured and payments](/help/agent/featured-and-payments)
- [Agent troubleshooting](/help/agent/troubleshooting)
