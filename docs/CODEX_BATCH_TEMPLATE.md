# PropatyHub Codex Batch Template

Use this template for future batches. Replace bracketed placeholders and remove sections that do not apply.

---

You are Codex working in the PropatyHub / RentNow repo.

Operate as the lead [engineering / product / ops / documentation] engineer for this batch. Be rigorous, conservative, and repo-first.

You have authority to inspect repo truth, make the smallest safe changes required, run validation, commit, and push directly to `main` after validation.

========================
BATCH TITLE
========================
[Clear batch title]

========================
WHY THIS BATCH EXISTS
========================
[Brief problem framing. State the real business or operational problem, not just the symptom.]

========================
OBJECTIVE
========================
[State the exact outcome this batch must produce.]

========================
NON-NEGOTIABLE CONSTRAINTS
========================
1. Keep scope narrow.
   - No stealth redesign.
   - No speculative rewrite.
   - No backlog theatre.

2. Use repo truth.
   - Audit first.
   - Do not guess existing behavior, schema, or route contracts.

3. Preserve trust boundaries.
   - Do not weaken privacy, auth, role, admin, billing, or entitlement controls.

4. Reuse existing patterns.
   - Prefer existing routes, helpers, analytics rails, admin surfaces, and notification rails.

5. Be explicit about migrations.
   - If a SQL migration is created or changed, remote apply is mandatory before calling the batch done.

========================
STEP-0 AUDIT FIRST
========================
Before changing code, inspect repo truth and report:

A. Current implementation
- models
- routes
- pages/components
- tests
- docs/runbooks if relevant

B. Existing constraints
- role/privacy/admin boundaries
- billing/entitlement rules if relevant
- migration/schema expectations
- monitoring/ops constraints if relevant

C. Root cause or product gap
- whether the problem is code, ops/process, validation, or strategy
- whether repo truth shows one coherent root cause or several

D. Smallest safe fix plan
- exact implementation path
- what must be added now
- what should explicitly wait

Do not implement before the audit is concrete.

========================
IMPLEMENTATION RULES
========================
- Fix the real issue, not the symptom only.
- Keep the change bounded.
- Prefer additive, reversible changes.
- If the batch touches trust-critical flows, state the risk and preserve boundaries explicitly.
- If the batch is docs-only or ops-only, do not force unrelated code churn.

========================
MIGRATION RULES
========================
If this batch creates or changes a SQL migration:

1. Add the migration file.
2. Add or update migration contract coverage if appropriate.
3. Run:

```bash
npm --prefix web run db:migrations:status
```

4. If pending migrations exist, apply them remotely:

```bash
cd web
npx supabase@latest db push --include-all
```

If the actual command differs in this repo context, report the exact command that was run.

Do not claim completion for schema-backed work without remote schema alignment.

========================
VALIDATION RULES
========================
Run targeted tests first, then full validation as appropriate.

Default commands:

```bash
npm --prefix web test
npm --prefix web run lint
npm --prefix web run build
```

If the batch is docs-only, use lightweight validation only and report that heavyweight validation was intentionally not required.

========================
OUTPUT FORMAT REQUIRED
========================
Return in exactly this structure unless the user specifies a different exact structure:

A. Step-0 audit  
B. Root cause  
C. Product scope decisions  
D. What was implemented  
E. Files changed  
F. Validation results  
G. Risks / follow-up items  
H. Commit SHA  
I. Rollback command

Be file-specific and honest.

========================
QUALITY BAR
========================
When this batch is done:
- the real repo-truth problem should be identified first
- the implementation should be narrow and defensible
- trust, privacy, role, admin, and monetisation boundaries should remain intact
- migrations should be aligned remotely if schema changed
- validation should match the risk of the batch
- the final report should be actionable for the next engineer or operator

========================
GIT DISCIPLINE
========================
- Work directly on the checked-out repo
- Make the smallest coherent batch
- Stage only relevant files
- Commit with a precise message
- Push to `main`
- Report the exact commit SHA and rollback command

Now begin with the Step-0 audit, confirm repo truth, then implement the batch cleanly.
