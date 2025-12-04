# RentNow Roadmap (Near-Term)

## Priority 0: Unblock Live Data
- Set `NEXT_PUBLIC_SITE_URL=https://www.rentnow.space` in Vercel env; redeploy.
- Verify `/api/properties` and `/api/properties/[id]` in production return data client-side; remove demo fallbacks once confirmed.
- Temporarily set `images.unoptimized = true` in `next.config.ts` if Unsplash `_next/image` 404s persist; confirm images render, then re-enable optimizer with proper domains.
- Migrate `middleware` to `proxy` to remove the deprecation warning.

## Priority 1: Stability & Cleanup
- Remove debug routes (`/api/debug/*`) after confirmation.
- Add integration tests (Playwright) for auth + properties listing/detail.
- Add server logging around API fetches to catch missing env/URL issues in prod.
- Normalize properties page/detail to single fetch path and shared mapper; eliminate mock fallback in production mode.

## Priority 2: Data & Admin
- Admin: add bulk approval + activity log; inline edit-in-place.
- Profile: add host badges and verification (phone/email/bank if applicable).
- Seed pipeline: CLI/SQL + CSV import for properties/images; dedup images.

## UX/UI Enhancements
- Map clustering + heatmap for browse; location-aware suggestions.
- Rich property detail: availability calendar, similar listings, host card with response time and trust markers.
- Discovery chips: business/family/creative, budget sliders, “near transit” filter.
- Speed: optimistic UI for save/viewings, skeletons, offline/PWA for saved searches.
- Visual polish: stronger typography pairing, micro-animations on cards, staggered reveal, refreshed map theme.

## AI/Assist (Optional)
- AI description rewrite for hosts; AI search (natural language) for tenants.
- AI “similar listings” suggestions.

## Observability
- Add simple logging for API fetch failures (env/URL, status) and image load errors.
- Health check endpoint for Supabase connectivity.
