# Payments Guardian Report Template

Use this template for every Payments Guardian v1 run.

## 1. Summary

- Run date:
- Review window:
- Trigger:
  - weekday schedule
  - post-merge review
  - pre-cutover review
- Evidence confidence:
  - live evidence
  - mixed
  - repo-history inference only
- Output status:
  - `report only`
  - `review required`
  - `blocked pending approval`

## 2. Payment-lane snapshot

List each lane:

- Stripe subscriptions
- Paystack subscriptions
- Stripe shortlet non-NGN lanes
- Paystack shortlet NGN lanes
- Paystack NGN PAYG listing fees
- canonical featured activation payments
- Flutterwave watch context

For each lane:

- current state:
  - stable
  - watch
  - blocked
- confidence drift:
  - improved
  - unchanged
  - worsened

## 3. In-scope changes observed

### Code or config surfaces

- `...`

### Payment docs and cutover docs

- `...`

### Recent payment-related update notes

- `...`

## 4. Findings grouped by lane or cross-lane risk

Use one block per important finding.

### Finding N

- Severity:
  - `S1 Critical`
  - `S2 High`
  - `S3 Medium`
  - `S4 Low`
- Lane or cross-lane scope:
- What changed or drifted:
- Why it matters:

## 5. Classification

For each important finding:

- Primary class:
  - `code/docs drift`
  - `webhook/config ambiguity`
  - `reconcile/cutover risk`
  - `launch-readiness watch item`
  - `release-gate blocker`
- Evidence:
- Confidence:
  - high
  - medium
  - low

## 6. Likely affected lane

For each important finding:

- affected lane(s):
- likely owner area:
- likely root-cause family:
  - docs drift
  - provider config
  - webhook integrity
  - reconcile fallback
  - cutover checklist drift
  - featured model ambiguity
  - other

## 7. Recommended next action

Use one of these labels only:

- `monitor only`
- `verify release gate`
- `stabilization batch`
- `docs patch batch`
- `operator config fix`
- `escalate for product review`

For each important finding:

- action:
- why:

## 8. Recently shipped payment changes worth operator awareness

List only the payment-related shipped changes that could affect launch confidence or operator behavior.

- update note:
- likely relevance:
- operator impact:

## 9. Optional patch or stabilisation targets

List only when obvious.

- target file or doc:
- suggested batch title:
- why it is likely safe or unsafe:
- review requirement:

