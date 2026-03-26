# Help Docs Workflow

Use `web/docs/help/**` as the docs-first source of truth for the in-app Help Centre.

## Structure

- `web/docs/help/tenant/*`
- `web/docs/help/landlord/*`
- `web/docs/help/agent/*`
- `web/docs/help/admin/*`
- `web/docs/help/troubleshooting/*`
- `web/docs/help/success/*`

## Visibility model

- `tenant`, `landlord`, and `agent` help content is public help.
  - these guides may be linked from the public help centre
  - they should remain accessible to logged-in and non-logged-in users
- `admin` help content is internal help.
  - these guides live under `web/docs/help/admin/*`
  - they are exposed only through the route-protected `/help/admin/**` surface
  - do not place admin or ops tutorials under public role folders

Rule for new tutorials:

1. Put admin, ops, moderation, payments-ops, bulk-cleanup, and internal tooling tutorials in `web/docs/help/admin/*`.
2. Put landlord, agent, and tenant training in the matching public role folder.
3. If the tutorial should be public, it must not depend on admin-only routes or internal operational actions.

## Frontmatter

Every help page must include:

- `title`
- `description`
- `order` (number)
- `updated_at` (`YYYY-MM-DD`)

## Definition of Done (feature PR)

1. Release note added in `web/docs/updates/YYYY-MM-DD-*.md`.
2. Help docs updated in `web/docs/help/**` for impacted roles, or justified in `web/docs/help/_no-help-change.md`.
3. Tests updated for changed behaviour (unit/integration where appropriate).
4. Product updates sync/import completed and drafts verified in admin.
5. Node 20 checks pass: lint, test, build.

## Authoring guidance

- Keep content task-based and route-accurate.
- Prefer practical checklists over long narrative text.
- Include real in-app routes in links (for faster support handoff).
- Use callouts for high-risk guidance (`<Callout type="warning">...</Callout>`).

## Template

Start from `web/docs/help/_TEMPLATE.md`.
