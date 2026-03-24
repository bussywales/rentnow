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

## 2. Evidence confidence

- Live workflow metadata available:
  - `yes`
  - `no`
- Direct release-gate evidence available:
  - `yes`
  - `no`
- Confidence in current-state claims:
  - `high`
  - `medium`
  - `low`
- Confidence note:

## 3. Current observed health

Use this section only for direct current evidence.

- Overall health:
  - `green`
  - `amber`
  - `red`
  - `unknown`
- Release-gate state:
- Important workflow count:
- Repeated failures observed in-window:
- Immediate blockers directly observed:
- Evidence used:

## 4. Historical instability patterns

Use this section for repo-history evidence only. Do not present these items as currently red unless the current observed health section also proves that.

- Repeated failure families seen in recent history:
- Relevant stabilization or update-note evidence:
- Historical lanes worth watching:
- Why this matters to the next review:

## 5. Unverified risks / unknowns

Use this section when workflow metadata or direct gate evidence was unavailable.

- Current unknowns:
- Likely risks inferred from repo history:
- What is not yet verified:
- What evidence is missing:

## 6. Classification

Use one block per important current finding. If there are no directly observed current failures, say so explicitly and do not promote historical instability into a current finding.

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
  - `unknown`

## 7. Likely affected area

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

## 8. Recommended next action

For each important finding:

- action:
  - no action
  - monitor only
  - verify release gate
  - stabilization batch
  - workflow diagnostics batch
  - docs/update-note follow-up
  - operator config fix
  - escalate for product review
- why:
- evidence basis:
  - current observed health
  - historical instability pattern
  - unverified risk / inference

## 9. Recently shipped changes worth operator awareness

List only the recent shipped changes that could plausibly explain CI or release-health movement.

- update note:
- likely relevance:
- operator impact:

## 10. Optional patch or stabilisation targets

List only when obvious.

- target file or workflow:
- suggested batch title:
- why it is likely safe or unsafe:
- review requirement:
