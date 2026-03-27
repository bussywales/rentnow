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

1. Default to the authored tutorial platform at `/admin/help/tutorials` for walkthroughs, video-led tutorials, audience-specific training, feature onboarding, and other tutorial content that changes regularly.
2. Publish internal admin, ops, moderation, payments-ops, bulk-cleanup, and tooling tutorials as authored `admin` tutorials so they stay behind `/help/admin/**`.
3. Publish tenant, landlord, and agent training as authored public tutorials unless the content is truly durable static reference documentation.
4. If the tutorial should be public, it must not depend on admin-only routes or internal operational actions.

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

- Tutorial-style help now defaults to the internal editor at `/admin/help/tutorials`.
  - use this for walkthroughs, feature onboarding, audience-specific training, draft/publish workflows, and optional YouTube embeds
  - published tutorials are merged into the live help routes without manual file edits
- Keep content task-based and route-accurate.
- Prefer practical checklists over long narrative text.
- Include real in-app routes in links (for faster support handoff).
- Use callouts for high-risk guidance (`<Callout type="warning">...</Callout>`).

Use file-backed markdown when:

- you are editing durable static runbooks, stable reference pages, or playbooks already stored in `web/docs/help/**`
- the content is repo-reviewed operational guidance that should remain file-backed long term
- the content does not need authoring-state controls, public SEO metadata, or video-url handling

## Template

Start from `web/docs/help/_TEMPLATE.md`.
