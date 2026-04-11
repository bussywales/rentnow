# Move & Ready Services pilot runbook

## Pilot purpose

Validate whether a tightly scoped property-prep request-routing wedge creates real host/landlord demand that can be matched and handled without turning PropatyHub into a broad services marketplace.

## Pilot scope

- Requesters: landlords, hosts, and agents only
- Categories only:
  - end-of-tenancy cleaning
  - fumigation / pest control
  - minor repairs / handyman
- Routing model: operator-governed lead routing
- Provider model: vetted providers only
- Response model: tokenized provider response links
- No scheduling, payments, reviews, or public provider browse

## Pilot geography

- Run only one market-country at a time.
- Run no more than two city/area clusters at once inside that market.
- Do not add a second market until the first market clears the validation scorecard.
- Record the live pilot geography in the weekly decision memo before opening requests to users.

## Pilot cohorts

### Requester cohort

- Existing landlords, hosts, and agents already active in the host workspace
- Prefer users with:
  - an active or recently paused listing
  - a relist, turnover, or guest-readiness need

### Provider cohort

- Curated only
- Approved for one or more of the three pilot categories
- Approved for the active pilot geography
- Keep the cohort small enough that ops can audit each provider manually

## Operator responsibilities

### Daily

1. Review new requests in `/admin/services/requests`.
2. Check unmatched requests first.
3. Check delivery failures and resend or reroute where necessary.
4. Review provider responses and pause weak providers quickly.
5. Close the loop manually when a request cannot be matched.

### Weekly

1. Update the validation scorecard.
2. Review category mix and entrypoint split.
3. Review provider response quality and response times.
4. Review unmatched backlog age.
5. Decide `go`, `iterate`, or `pause` using the scorecard rules.

## Routing rules

Automatic routing only sends a lead when the provider is:

- `verification_state = approved`
- `provider_status = active`
- approved for the request category
- approved for the request market
- approved for the request city/area where specified

## Unmatched handling

- Do not tell the requester the job is covered.
- Leave the request visible in the unmatched queue.
- Use the request detail page to decide one of:
  - manually dispatch to a newly approved provider
  - keep as `unmatched_pending_manual_followup`
  - close the loop manually with the host if no safe provider exists

## Provider response expectations

- Providers should respond within 24 hours.
- Accepted leads should include one usable response note or quote note.
- Repeated non-response or repeated declines without a clear reason should trigger provider pause review.

## Daily review rhythm

### Start of day

1. Review all new requests from the last 24 hours.
2. Triage unmatched requests older than one business day.
3. Check lead delivery failures.

### Midday

1. Review newly accepted or declined leads.
2. Confirm any manual follow-up promises have an owner.

### End of day

1. Confirm there are no unmatched requests older than two business days without an explicit follow-up owner.
2. Record major issues for weekly review.

## Escalation rules

Escalate the pilot to product/ops review immediately if:

- unmatched backlog older than two business days exceeds 5 open requests
- lead delivery failures exceed 15 percent of sent leads in a week
- provider response rate falls below 35 percent in a week
- providers are being approved faster than ops can quality-check them
- hosts start using the flow for work outside the three pilot categories

## Exact exclusions

- No tenant requester flows
- No removals
- No move-in services
- No public provider directory
- No booking or scheduling flow
- No payment or payout flow
- No reviews or ratings
- No provider subscriptions or lead billing
- No expansion into broad trades categories before pilot sign-off
