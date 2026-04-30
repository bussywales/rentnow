# PropatyHub Engineering Operating Manual

## 1. Purpose

This document defines how engineering work is executed in the PropatyHub / RentNow repo.

It exists to stop three recurring failures:

- relying on chat memory instead of repo truth
- widening narrow asks into speculative product work
- calling work "done" before schema, validation, and operator reality are aligned

Use this manual before planning or implementing any batch.

## 2. Repo-First Working Model

This repo is the source of truth. Prompts, stakeholder requests, and remembered history are inputs, not authority.

Before changing code:

1. inspect the current implementation
2. inspect the routes, helpers, tests, and docs that already govern the area
3. identify the real product or operational contract already present in the repo
4. only then define the smallest safe change

Never assume a batch is greenfield if the repo already contains partial infrastructure.

## 3. Step-0 Audit Is Mandatory

Every non-trivial batch starts with a Step-0 audit.

The audit must answer, in repo truth:

- what exists now
- where the behavior is implemented
- what the current data model is
- what constraints already exist
- whether the issue is product logic, UX, validation, ops, or release discipline
- what the smallest safe implementation path is

A batch should not move from audit to implementation until the root cause or gap is concrete enough to defend.

## 4. Work Classification Rules

Classify the work before implementing it.

### Bug

Use when the intended behavior already exists or is clearly implied, but the code is wrong.

Examples:

- publish path incorrectly lands on `/forbidden`
- schema readiness check returns a false unhealthy state
- private fields leak in notifications

### Enhancement

Use when repo truth supports the direction, but the current behavior is incomplete.

Examples:

- add route-readiness signals to admin ops
- add supplier application intake to an existing curated services pilot
- add lightweight analytics to recently shipped surfaces

### Strategy / Product Decision

Use when the repo does not yet settle the product posture and implementation would otherwise guess.

Examples:

- deciding between open supplier marketplace vs curated routing
- deciding whether a role transition should exist at all
- deciding whether a search surface should widen taxonomy

Do not implement strategy by accident. Record it or wait for it.

### Ops / Process Issue

Use when the main problem is release discipline, runbooks, docs drift, monitoring, or operator workflow.

Examples:

- migrations created but not pushed remotely
- docs still pointing operators to deprecated debug routes
- release checks scattered across multiple notes

### Validation Issue

Use when the issue is baseline breakage, test trust, build drift, or validation coverage gaps.

Examples:

- long-lived baseline test failures
- routes behaving correctly but lacking regression coverage
- schema-backed changes without migration contract tests

## 5. Scope Discipline

All batches in this repo must stay narrow.

Rules:

- no stealth redesigns
- no speculative rewrites
- no giant taxonomy expansion unless the repo already demands it
- no dashboard sprawl when a compact readout on an existing surface will do
- no fake future-proofing layers that the current repo does not need
- no policy or monetisation weakening to make a bug appear fixed

A narrow batch may still be serious. "Narrow" means bounded and defensible, not trivial.

## 6. Trust-Critical Flows Require Extra Care

The following areas are high sensitivity and must be treated as such.

### Monetisation and entitlements

Includes:

- listing limits
- plan enforcement
- subscription state
- checkout and recovery paths
- publish / renew / reactivate flows

Rules:

- do not weaken billing gates to remove friction
- `forbidden` must only represent a real permission boundary
- use recovery states for billing/plan problems, not access-denied dead ends

### Auth, role, and account state

Includes:

- post-login routing
- onboarding state
- admin guards
- ambiguous role/account-state handling

Rules:

- unsupported role transitions must not be casually exposed
- incomplete account state must fail predictably
- do not patch the UI only if the backend state remains unsafe

### Privacy and notifications

Includes:

- requester data
- supplier/provider alerts
- host/tenant notifications
- admin/operator visibility

Rules:

- never leak contact details into a summary channel unless the product explicitly allows it
- keep opt-in alerting opt-in
- do not turn notifications into a broad spam mechanism

### Admin access and diagnostics

Includes:

- `/admin/**`
- `/api/admin/**`
- config status and monitoring views
- support and billing ops tools

Rules:

- public health routes should stay minimal and safe
- rich diagnostics are admin-only
- do not publish internal readiness state by accident

### Schema readiness and monitoring

Includes:

- health endpoints
- deep health
- config status
- Sentry and structured logging
- release-safety checks

Rules:

- users are not the debugging console
- schema/runtime mismatches must be caught internally where possible
- safe user messaging and rich internal context must coexist

## 7. Migration Discipline

Schema-backed work is not complete until the remote database state is aligned.

Required rules:

1. If a SQL migration is created or changed, remote apply is mandatory.
2. Report the migration filename(s) explicitly in the batch output.
3. Run the migration status check before claiming release readiness:

```bash
npm --prefix web run db:migrations:status
```

4. If migrations are pending, stop and apply them:

```bash
cd web
npx supabase@latest db push --include-all
```

5. If the repo workflow uses plain `db push` in practice for the linked project, report exactly what was run.
6. Do not claim a schema-backed batch is shipped if the code expects columns, tables, policies, or functions that are not yet remote.
7. Add migration contract tests for new operationally important schema.

## 8. Validation Discipline

Default validation standard for code changes:

1. targeted tests for touched areas first
2. full unit suite
3. lint
4. production build

Current repo commands:

```bash
npm --prefix web test
npm --prefix web run lint
npm --prefix web run build
```

Additional validation when relevant:

```bash
npm --prefix web run db:migrations:status
```

Use heavier validation when the batch touches:

- monetisation
- auth / role resolution
- notifications
- schema / health / monitoring
- shortlets
- admin ops surfaces

Manual verification is required when behavior depends on:

- remote schema state
- real env/config readiness
- third-party providers
- operator-facing flows that tests only partially cover

Docs-only batches should use lightweight validation only. Be explicit when heavy commands were intentionally not run.

## 9. Required Codex Batch Output Format

Default batch report structure in this repo:

- `A. Step-0 audit`
- `B. Root cause` or `B. Root cause / gap`
- `C. Product scope decisions`
- `D. What was implemented`
- `E. Files changed`
- `F. Validation results`
- `G. Risks / follow-up items`
- `H. Commit SHA`
- `I. Rollback command`

When the user specifies an exact structure, follow that exact structure instead.

## 10. Git Discipline

Rules:

- make the smallest coherent batch
- stage only the files relevant to the batch
- commit with a precise message
- report the exact commit SHA
- provide a rollback command
- do not leave migration state implicit
- do not hide unrelated worktree changes inside the batch

Default rollback form:

```bash
git revert <commit-sha>
```

## 11. Update Notes, Help, and Operator Docs

This repo enforces release-note discipline for user-visible and admin-visible work.

Rules:

- User-visible changes must add a note under `web/docs/updates/`.
- If a batch is not user-visible, add the repo-approved no-update justification file instead of pretending nothing changed.
- Docs-only changes under `docs/**` and `web/docs/**` do not themselves trigger a user update note unless the batch also changes user-visible behavior.
- If a batch changes an operator-facing workflow, update the relevant runbook, help doc, or checklist in the same batch.

Reference: [docs/CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)

## 12. Stakeholder Ask Handling

Stakeholder asks are often broader, noisier, or less precise than the engineering task.

Normalize each ask into:

- the real product problem
- the workstream it belongs to
- whether it is code, ops, strategy, or validation
- the smallest safe batch that addresses it

Rules:

- do not treat stakeholder guesses as root cause
- do not widen a narrow incident into a redesign
- do not confuse policy direction with implementation detail
- if the ask is really about release discipline or operator process, say so explicitly
- if the ask contains multiple bugs, group them only when the repo shows one coherent root cause

## 13. Workstream Classification Rules

Use these statuses in durable planning docs and audits:

- `COMPLETE`: materially done for now, with no essential next layer missing
- `NARROWLY COMPLETE`: shipped and coherent, but intentionally first-pass
- `PARTIAL`: meaningful work shipped, but essential next product or ops layer remains
- `DEFERRED / NARROW BY DESIGN`: intentionally not expanded further in the current batch
- `NOT STARTED / MINIMAL`: little or no meaningful product/system layer exists yet

Do not mark something complete just because code exists.

## 14. What “Done” Means Here

A batch is done only when all of the following are true:

- the real repo-truth problem was identified first
- implementation stayed within scope
- trust, privacy, role, and monetisation boundaries were preserved
- migrations were created and remotely applied when required
- validation was run at the right level
- docs/runbook/update-note obligations were handled where relevant
- the final report is concrete enough for an operator or future engineer to use

If any of those are missing, the batch is not done. It is only partially implemented.

## 15. Key Repo Conventions To Preserve

- Canonical roadmap: [docs/product/ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- Update-note enforcement: [docs/CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)
- Release checklist: [docs/RELEASE_CHECKLIST.md](/Users/olubusayoadewale/rentnow/docs/RELEASE_CHECKLIST.md)
- Migration runbook: [web/docs/ops/supabase-migrations.md](/Users/olubusayoadewale/rentnow/web/docs/ops/supabase-migrations.md)
- Current package commands: [web/package.json](/Users/olubusayoadewale/rentnow/web/package.json)

Use this manual as the repo operating baseline. Treat ad hoc prompt wording as secondary when it conflicts with durable repo discipline.
