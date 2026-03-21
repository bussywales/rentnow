# Codex Automation Operating Summary

Use this as the fast reference. Use [CODEX_AUTOMATION_ARCHITECTURE.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ARCHITECTURE.md) as the canonical operating model.

| Agent | Cadence | Primary inputs | Default outputs | Approval level |
| --- | --- | --- | --- | --- |
| Payments Guardian | Weekday morning, plus pre-cutover | Payments audits, hardening plan, cutover checklist, billing ops surfaces | Lane status, blocker list, cutover checklist delta | Review required for any behavior or config change |
| Marketplace Quality Agent | Weekly | Marketplace review docs, analytics interpretation docs, request/host quality signals | Signal review, bottleneck memo, checklist delta | Review required for any product behavior change |
| CI & Release Health Agent | Post-merge and daily | Workflow files, failed runs, go-live suite | Failure triage, flaky-test shortlist, workflow diagnostics patch | Workflow/test-only fixes can be low-risk; product fixes need review |
| Docs & Help Drift Agent | Daily and post-merge | Help coverage audit, update notes, internal docs, route changes | Drift report, docs patch, audit refresh | Docs-only updates are auto-allowed |
| Growth & Funnel Agent | Weekly | Explore V2 docs, discoverability changes, request/save/search flows | Funnel memo, entry-point recommendations | Recommendations only without approval |
| Admin Ops Agent | Weekly | Admin ops docs, admin help, billing/payments ops docs | Runbook delta, operator gap list | Review required for any admin behavior change |
| Product Strategy Agent | Weekly or pre-review | Roadmap, marketplace review, payments docs, revenue docs | Ranked next-decision memo | Strategy recommendations require leadership review |

## Default automation rules

- Default output: report first, patch second.
- Auto-allowed: docs-only, checklist updates, workflow diagnostics, test-only stabilization.
- Review required: product behavior, admin actions, analytics semantics, payment flow changes.
- Never autonomous: secrets, live cutover, pricing, entitlements, destructive data, legal or policy changes.

## Recommended first automations

1. Payments Guardian
2. CI & Release Health Agent
3. Docs & Help Drift Agent
4. Admin Ops Agent

## Scheduling discipline

- Daily automations should focus on drift, failures, and readiness.
- Weekly automations should focus on analysis, prioritization, and operational trend review.
- Anything risky should stop with a review-required output instead of acting.

