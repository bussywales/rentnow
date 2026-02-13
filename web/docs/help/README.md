# Help Docs Workflow

Use `web/docs/help/**` as the docs-first source of truth for the in-app Help Centre.

## Structure

- `web/docs/help/tenant/*`
- `web/docs/help/landlord/*`
- `web/docs/help/agent/*`
- `web/docs/help/admin/*`
- `web/docs/help/troubleshooting/*`
- `web/docs/help/success/*`

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
