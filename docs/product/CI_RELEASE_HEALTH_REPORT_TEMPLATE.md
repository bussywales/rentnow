# CI & Release Health Report Template

Use this template for every CI & Release Health Agent v1 run.

## 1. Summary

- Run date:
- Review window:
- Trigger:
  - weekday schedule
  - post-merge review
  - pre-release review
- Output status:
  - `report only`
  - `review required`
  - `blocked pending approval`

## 2. Health snapshot

- Overall health:
  - `green`
  - `amber`
  - `red`
- Release-gate state:
- Important workflow count:
- Repeated failures:
- Immediate blockers:

## 3. Failing runs

List only the important runs in the review window.

For each run:

- workflow:
- job:
- first failing step:
- occurred at:
- repeated or one-off:

## 4. Classification

Use one block per important failure.

### Finding N

- Severity:
  - `S1 Critical`
  - `S2 High`
  - `S3 Medium`
  - `S4 Low`
- Primary class:
  - `real regression`
  - `flaky`
  - `infra/config`
  - `release-gate blocker`
- Why this classification fits:
- Evidence:
- Is shipment blocked:
  - `yes`
  - `no`

## 5. Likely affected area

For each important finding:

- surface or lane:
- likely owner area:
- likely root-cause family:
  - shared app/runtime
  - test harness
  - workflow diagnostics
  - secrets/config
  - migration/deploy drift
  - payments/ops lane
  - other

## 6. Recommended next action

For each important finding:

- action:
  - monitor only
  - stabilization batch
  - workflow diagnostics batch
  - docs/update-note follow-up
  - operator config fix
  - escalate for product review
- why:

## 7. Recently shipped changes worth operator awareness

List only the recent shipped changes that could plausibly explain CI or release-health movement.

- update note:
- likely relevance:
- operator impact:

## 8. Optional patch or stabilisation targets

List only when obvious.

- target file or workflow:
- suggested batch title:
- why it is likely safe or unsafe:
- review requirement:

