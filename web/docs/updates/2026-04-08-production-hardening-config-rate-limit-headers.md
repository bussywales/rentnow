---
title: "Production hardening: config fail-fast, shared rate limits, and baseline headers"
audiences: ["ADMIN"]
areas: ["security", "platform", "billing"]
cta_href: "/help/admin/analytics"
published_at: "2026-04-08T12:00:00Z"
---

- Removed silent production fallback from `lib/env.ts`; missing `SITE_URL` or `NEXT_PUBLIC_SITE_URL` now fails hard instead of resolving to `http://localhost:3000`.
- Added baseline response headers in `next.config.ts`: frame denial, MIME sniffing protection, stricter referrer policy, and a narrow permissions policy.
- Enabled HSTS only in production and intentionally skipped `includeSubDomains` / `preload` pending a full hostname audit.
- Did not ship a CSP in this batch. The app still needs a dedicated CSP pass because Stripe, Supabase, maps, and third-party embeds need an audited allowlist first.
- Moved production-sensitive push, explore analytics, and messaging rate limiting onto a shared DB-backed limiter with in-memory fallback only as a degraded path.
- Tightened hot-path profile reads by replacing `profiles.select("*")` in `lib/auth.ts` and `lib/legal/jurisdiction.server.ts` with explicit column lists.
- Remaining caveat: support’s in-memory messaging rate-limit snapshot is still local-process only; production throttle truth remains the DB-backed telemetry rows.
