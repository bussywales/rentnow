# Move & Ready Services validation scorecard

## Decision cadence

- Weekly operating review
- Formal expansion decision only after:
  - at least 4 pilot weeks, and
  - at least 15 submitted requests

If the sample is smaller than that, the pilot is still `insufficient signal`.

## Metrics and thresholds

### Demand capture

- Submitted requests in the last 28 days
  - go: `>= 15`
  - iterate: `8-14`
  - pause/rework: `< 8`

### Match rate

- `service_request_matched / service_request_submitted`
  - go: `>= 70%`
  - iterate: `50-69%`
  - pause/rework: `< 50%`

### Unmatched rate

- `service_request_unmatched / service_request_submitted`
  - go: `<= 30%`
  - iterate: `31-50%`
  - pause/rework: `> 50%`

### Provider response rate

- `(provider_lead_accepted + provider_lead_declined) / provider_lead_sent`
  - go: `>= 60%`
  - iterate: `35-59%`
  - pause/rework: `< 35%`

### Provider accepted-rate quality check

- `provider_lead_accepted / provider_lead_sent`
  - go: `>= 30%`
  - iterate: `15-29%`
  - pause/rework: `< 15%`

This is not a standalone go/no-go metric, but it is a warning if providers are repeatedly declining poor-fit leads.

### Response time

- Median first provider response time
  - go: `<= 24h`
  - iterate: `> 24h and <= 48h`
  - pause/rework: `> 48h`

This is an operator-reviewed metric until a dedicated reporting view exists.

### Delivery reliability

- Delivery failures / sent leads
  - go: `< 10%`
  - iterate: `10-15%`
  - pause/rework: `> 15%`

### Request quality

- Share of submitted requests judged valid property-prep use cases in weekly review
  - go: `>= 80%`
  - iterate: `60-79%`
  - pause/rework: `< 60%`

### Operator burden

- Open unmatched requests older than 2 business days
  - go: `0-2`
  - iterate: `3-5`
  - pause/rework: `> 5`

- Median operator handling time per request
  - go: `<= 15 min`
  - iterate: `16-25 min`
  - pause/rework: `> 25 min`

This remains a manual ops log metric during pilot.

### Entrypoint relevance

- Requests from contextual host surfaces using `entrypoint_source`
  - review split between:
    - `host_overview`
    - `host_listings`
- Desired result:
  - at least one entrypoint produces repeat weekly usage

If both entrypoints are quiet after 4 weeks, do not expand. Rework entry visibility first.

## Go / iterate / pause logic

### Go

Proceed to a tightly controlled next batch only if all are true:

- sample size threshold met
- match rate is in `go`
- provider response rate is in `go`
- median response time is in `go` or high `iterate`
- unmatched backlog older than 2 business days stays at `<= 2`
- request quality is in `go`

### Iterate

Keep the wedge narrow and improve ops/copy/routing if any are true:

- demand exists but match rate is `50-69%`
- provider response rate is `35-59%`
- response time is slower than 24h but still under 48h
- operator burden is rising but not breaking
- one entrypoint is clearly underperforming

### Pause / rework

Pause expansion and rework the wedge if any are true for two straight weekly reviews:

- match rate `< 50%`
- provider response rate `< 35%`
- median first response time `> 48h`
- delivery failure rate `> 15%`
- unmatched backlog older than 2 business days `> 5`
- request quality `< 60%`

## What does not justify expansion yet

- a few anecdotal successful requests
- provider interest without response discipline
- admin enthusiasm without scorecard pass
- demand from out-of-scope categories

## Exact expansion gate

Do not expand to new requester groups, new categories, or any booking/payment logic until the wedge has:

1. passed the `go` rule for two consecutive weekly reviews, and
2. produced at least 15 submitted requests with operationally acceptable burden
