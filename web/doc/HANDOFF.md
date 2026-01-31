# Handoff (Dec 4, 2025)

## What changed right now
- Forced live data paths for browse/detail/dashboard: `/api/properties` must resolve; no silent mock fallbacks. Errors surface in UI with status hints.
- Added `lib/env.getSiteUrl()` to normalize base URLs (prefers `NEXT_PUBLIC_SITE_URL`/`SITE_URL`/`VERCEL_URL`, then request headers) so server fetches work in prod and previews.
- Disabled Next image optimizer (`unoptimized: true`) to bypass Unsplash 404s; will revisit once remote fetch succeeds. Canonical host redirect now lives in `next.config.ts` redirects; middleware removed.
- Added lightweight server logs: `[properties]...` and `[property detail]...` in Vercel logs show counts, ids, and API URLs to debug live data mismatches.

## Required actions after deploy
1) Set `NEXT_PUBLIC_SITE_URL=https://www.propatyhub.com` (and `SITE_URL` optionally) in Vercel Project → Environment Variables; redeploy.  
2) Hard refresh the live site; confirm `/api/properties` and `/api/properties/<id>` return the 8 seeded rows (titles: Skyline Loft in Victoria Island, Garden Townhouse in Lekki Phase 1, ...).  
3) Check images: with `unoptimized: true` they should render directly from Unsplash. If stable, re-enable the optimizer by removing that flag.  
4) Verify detail pages: open a couple of IDs from the API response; confirm no “Listing not found.” If it happens, check the log entries for the id/apiUrl.  
5) Dashboard: ensure the list shows live Supabase data (no mock cards). If empty, check Supabase RLS and that `is_approved`/`is_active` are true.

## Observability & debugging
- Logs: Vercel function logs will show `[properties]` (list/filter) and `[property detail]` with counts and API URLs.  
- API fallbacks: `/api/properties` and `/api/properties/search` now return 503 when Supabase env is missing, so misconfigurations are visible.  
- Base URL: `lib/env.ts` is the single source of truth—if host routing changes, adjust there.

## Near-term UX/feature leads
- Images: swap back to optimized mode once Unsplash fetch is fixed; add blur-up placeholders for cards/gallery.  
- Discovery: add mood/location chips + a clustered map layer; enable instant filters with optimistic updates.  
- Trust: show host badges/response times and add inline availability calendars on detail pages.  
- AI: AI-powered search query parsing and “similar listings” carousel using embeddings from live data.
