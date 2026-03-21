# Docs & Help Drift Report Template

Use this template for every Docs & Help Drift Agent v1 run.

## 1. Run metadata

- Run date:
- Trigger:
  - weekday schedule
  - post-merge review
- Review window:
- Reviewer:
- Output status:
  - `report only`
  - `review required`
  - `blocked pending approval`

## 2. Files reviewed

### Changed product/admin surfaces

- `...`

### Update notes reviewed

- `...`

### Durable docs/help reviewed

- `...`

## 3. Likely drift findings

Use one block per finding.

### Finding N

- Severity:
  - `S1 Critical`
  - `S2 High`
  - `S3 Medium`
  - `S4 Low`
- Audience:
  - `ADMIN`
  - `HOST`
  - `TENANT`
  - `AGENT`
  - `OPERATOR`
  - `SHARED`
- Change observed:
- Evidence:
- Why this is likely drift:
- Impact if left stale:

## 4. Recommended patch targets

For each finding:

- target doc:
- target section:
- change type:
  - route update
  - label/status update
  - workflow clarification
  - ops/runbook clarification
  - cross-linking
  - update-note follow-through

## 5. Draftable now

List only the items that are clearly docs-only and safe to patch without product ambiguity.

- item:
- target file:
- brief proposed change:

## 6. Review-required items

List findings that need a human decision before docs should change.

- item:
- reason review is required:
- likely owner:

## 7. Blocked items

List findings where the repo does not provide enough truth to write durable docs safely.

- item:
- blocker:
- evidence missing:

## 8. Recommended next docs batch

- batch title:
- scope:
- files likely to change:
- why it is safe or not safe:
- rollback note:

