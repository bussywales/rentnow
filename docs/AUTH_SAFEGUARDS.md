# Auth Safeguards

These safeguards prevent auth session loss across redirects, idle refreshes, and hostnames.

## Health endpoints

- `GET /api/auth/health`
  - 200: `{ ok: true, userId, email?, role? }`
  - 401: `{ ok: false }`
- `GET /api/auth/health/protected`
  - 200: `{ ok: true, userId, email?, role? }`
  - 401: `{ ok: false }`

Both endpoints return `Cache-Control: no-store` and never log or expose tokens.

## Playwright auth smoke test

Required env vars:
- `E2E_EMAIL`
- `E2E_PASSWORD`

Optional:
- `PLAYWRIGHT_BASE_URL` (defaults to `NEXT_PUBLIC_SITE_URL` or `http://localhost:3000`)

Run locally:
```bash
cd web
E2E_EMAIL="you@example.com" E2E_PASSWORD="secret" npm run test:e2e -- tests/playwright/auth-smoke.spec.ts
```

If Playwright was just installed or updated, run `npx playwright install --with-deps` first.

If credentials are missing, the test skips with a clear message.

## Canonical domain redirect

Apex requests (`https://rentnow.space`) redirect to `https://www.rentnow.space` for all
non-static, non-API routes. This keeps auth cookies stable across hostnames.

Do not remove the redirect rule in `web/next.config.ts`.
