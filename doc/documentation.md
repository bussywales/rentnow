# RentNow Documentation (Current State)

## Auth and Sessions
- Supabase auth cookies now read on the server; `createServerSupabaseClient` binds `setSession` and awaits it before queries.
- Debug endpoint `/api/debug/session` shows `cookieFound`, `tokensFound`, and user details when logged in.
- Ensure `NEXT_PUBLIC_SITE_URL=https://www.rentnow.space` is set in Vercel for server-side fetches.

## Data/API
- Properties API now supports GET: `/api/properties` returns properties with `property_images`.
- Property detail API: `/api/properties/[id]` returns a property with images.
- Many pages now fetch via APIs (`dashboard`, `properties list`, `property detail`) to avoid build-time mock data.

## Database Seeding (Current Sample)
Owner: `840c7804-40ab-4aa7-8818-2e6a6fdd3550` (role admin). Properties seeded with unique UUIDs/titles/images:
- Skyline Loft in Victoria Island — `3d0a1e1e-8a2a-4f7a-9a8a-111111111111`
- Garden Townhouse in Lekki Phase 1 — `4b2c2f2f-9b3b-5c8b-ab9b-222222222222`
- Riverside Flat in Zamalek — `5c3d3a3a-ac4c-6d9c-bcab-333333333333`
- Heritage Apartment in Ikoyi — `6e4f4b4b-bd5d-7e0d-cdbc-444444444444`
- Designer Studio in Kilimani — `7f505c5c-ce6e-8f1e-decd-555555555555`
- Sea Breeze Condo in Dakar Almadies — `8a616d6d-df7f-901f-efde-666666666666`
- Oakwood Villa in East Legon — `9b727e7e-e08a-a120-f0ef-777777777777`
- Summit Duplex in Sandton — `ac838f8f-f19b-b231-0110-888888888888`

Images: unique Unsplash URLs (allowed via `images.unsplash.com` in `next.config.ts`). If optimizer 404s persist, temporarily set `images.unoptimized = true`.

## Known Issues (Open)
- Frontend still renders duplicated/mock content and one image despite APIs returning unique rows. Likely missing `NEXT_PUBLIC_SITE_URL` in prod or stale cached bundle.
- `_next/image` 404 for Unsplash URLs in production; may require `unoptimized: true` or verifying the optimizer URL is correct (no double-encoding).
- Detail page sometimes shows “Listing not found” if fetch fails; remove demo fallback once API fetch is confirmed working in prod.
- Middleware deprecation warning: `middleware` -> `proxy` migration pending.

## Recent Fixes (Key Commits)
- `8362671`: Add GET handler for `/api/properties`.
- `2368766`: Dashboard fetches properties via API.
- `280e5c7`: Property detail fetches via API.
- `d759d2a`: Properties page forced dynamic and uses API data.

## Environment
- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (set to `https://www.rentnow.space`).

## Debug Endpoints
- `/api/debug/session`: Inspect server-side auth state (remove after stabilization).
- `/api/debug/env`: Presence check for env vars (remove after stabilization).

## Notes
- Demo fallbacks exist in several pages; remove them once live data is confirmed working.
- Build warnings: `_next/image` 404 for Unsplash, font preload warnings (non-blocking). 
