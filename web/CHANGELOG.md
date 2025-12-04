# Changelog

## 0.2.2 — 2025-12-04
- Enforced live Supabase data on browse/detail/dashboard; removed mock fallbacks and surface API/Supabase errors instead of demo cards.
- Added `getSiteUrl` helper so server fetches resolve correctly across prod/preview/local without relying solely on `NEXT_PUBLIC_SITE_URL`.
- Temporarily disabled Next image optimizer (`unoptimized: true`) to stop Unsplash `_next/image` 404s; will revert once remote fetch works. Canonical host redirect now uses `next.config.ts` redirects (middleware removed).
- Added light server logging to trace API URLs and record counts in Vercel logs while debugging live data.

## 0.2.1 — 2025-12-04
- Property gallery with thumbnails, admin filters/search, Supabase auth/session hardening, demo/live helpers, security patch (Next.js/React CVE fixes).
