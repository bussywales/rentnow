# Changelog

## 0.2.11 — 2025-12-06
- Dashboard isolation: `/api/properties?scope=own` and `/api/properties/:id?scope=own` enforce owner/admin access; dashboard list/edit now use the scoped endpoints; fallback Supabase fetch also checks owner/admin.
- Tenant gating: tenants are redirected away from the dashboard to favourites; nav hides dashboard for tenants client and server side.
- Version bump for role isolation and confirm/login redirect support.

## 0.2.10 — 2025-12-06
- Magic-link flow tightened: `/auth/confirm` catches PKCE verifier errors and routes users to log in with a redirect back to onboarding; messaging is clearer that email is confirmed.
- Login accepts `?redirect=` so auth flows can send users to the right destination post-sign-in.
- Version bump and copy updates.

## 0.2.9 — 2025-12-06
- `/auth/confirm` handles magic-link PKCE errors gracefully (e.g., code verifier missing when the link opens in another browser) and guides users to log in then continue to onboarding.
- Registration success copy/buttons cleaned (ASCII-safe); onboarding gating remains enforced via dashboard layout.
- Docs and version bumped for the improved confirmation flow.

## 0.2.8 — 2025-12-06
- Restored `/auth/confirm` magic-link handler: exchanges Supabase `code` query params for a session, shows guidance, and routes users to onboarding to pick a role.
- Cleaned registration success copy and buttons (ASCII-safe) and kept login/onboarding pointers aligned with the confirmation flow.
- Dashboard layout now always sends users without a Supabase profile role to onboarding so they cannot bypass role selection.
- Docs/version bump for the refreshed auth flow and admin requirements.

## 0.2.7 — 2025-12-05
- Added admin user management at `/admin/users` (list users, send reset email, delete) backed by the Supabase service-role API and gated to admins.
- Introduced Playwright smoke tests plus CI workflow and cleanup script.
- Login/onboarding redirects tightened so authenticated users land on dashboard/onboarding reliably; saved properties use correct listing images.

## 0.2.2 — 2025-12-04
- Enforced live Supabase data on browse/detail/dashboard; removed mock fallbacks and surfaced API/Supabase errors instead of demo cards.
- Added `getSiteUrl` helper so server fetches resolve correctly across prod/preview/local without relying solely on `NEXT_PUBLIC_SITE_URL`.
- Temporarily disabled Next image optimizer (`unoptimized: true`) to stop Unsplash `_next/image` 404s; will revert once remote fetch works. Canonical host redirect now uses `next.config.ts` redirects (middleware removed).
- Added light server logging to trace API URLs and record counts in Vercel logs while debugging live data.

## 0.2.1 — 2025-12-04
- Property gallery with thumbnails, admin filters/search, Supabase auth/session hardening, demo/live helpers, security patch (Next.js/React CVE fixes).
