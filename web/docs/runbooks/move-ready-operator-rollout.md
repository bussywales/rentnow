# Move & Ready Services operator rollout

## Launch posture

- Host and landlord requests only.
- Categories only:
  - End-of-tenancy cleaning
  - Fumigation / pest control
  - Minor repairs / handyman
- No tenant requester flow.
- No public provider browse flow.
- No scheduling, payment, payout, or review handling in this launch.

## Operator responsibilities

1. Add curated providers in `/admin/services/providers`.
2. Approve only providers with real category and area coverage.
3. Pause providers quickly if lead quality or responsiveness drops.
4. Review `/admin/services/requests` for unmatched requests.
5. Manually dispatch unmatched requests from `/admin/services/requests/[id]` when a suitable provider exists.

## Matching rule

Automatic routing only sends leads to providers who are:

- `verification_state = approved`
- `provider_status = active`
- approved for the request category
- approved for the request market
- approved for the request city/area where specified

If no provider matches, the request remains `unmatched`.

## Unmatched request handling

- Do not tell the host the request is covered.
- Keep the request visible in the unmatched queue.
- Either:
  - add/approve a suitable provider, then dispatch manually
  - or close the loop with the host outside this flow

## Provider response handling

- Providers respond through the emailed token link.
- They can:
  - accept
  - decline
  - leave one short note
- Operators should review request detail to see:
  - sent
  - delivery failed
  - accepted
  - declined
  - response notes

## Explicit exclusions

- No instant booking
- No calendar coordination
- No in-app payment collection
- No payout logic
- No tenant-facing services marketplace
- No open provider self-signup
- No generic trades expansion beyond the three launch categories
