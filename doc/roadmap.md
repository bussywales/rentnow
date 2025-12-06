# RentNow Roadmap (Near-Term)

## Priority 0: Unblock Live Data
- Set `NEXT_PUBLIC_SITE_URL=https://www.rentnow.space` in Vercel env; redeploy.
- Verify `/api/properties` and `/api/properties/[id]` in production return data client-side; remove demo fallbacks once confirmed.
- Temporarily set `images.unoptimized = true` in `next.config.ts` if Unsplash `_next/image` 404s persist; confirm images render, then re-enable optimizer with proper domains.
- Migrate `middleware` to `proxy` to remove the deprecation warning.
- Auth bug: magic-link confirmation still fails with missing PKCE verifier when opened in another browser. Add a “email confirmed” landing screen that always redirects users to login with onboarding redirect, and validate Supabase email-confirmed flag before allowing role selection.

## Priority 1: Stability & Cleanup
- Remove debug routes (`/api/debug/*`) after confirmation.
- Add integration tests (Playwright) for auth + properties listing/detail.
- Add server logging around API fetches to catch missing env/URL issues in prod.
- Normalize properties page/detail to single fetch path and shared mapper; eliminate mock fallback in production mode.
- Fix nav auth hydration so protected links render immediately after client redirects (no refresh needed); ensure browser Supabase client drives nav state.
- Roles: enforce per-role dashboards. Tenants should see saved/viewings only (no owner listings); landlords/agents manage only their own listings. Filter dashboard queries by `owner_id = user.id` and tighten RLS so owners cannot see/update others’ records. Add tests for cross-user isolation.

## Priority 2: Data & Admin
- Admin: add bulk approval + activity log; inline edit-in-place.
- Profile: add host badges and verification (phone/email/bank if applicable).
- Seed pipeline: CLI/SQL + CSV import for properties/images; dedup images.
- Storage policy audit: ensure `property-images` insert/read for authenticated users; add public-read only if desired.
- Data hygiene: rerun `doc/seed_coordinates.sql` after reseeds; validate image URLs; reassign owners or use admin role to edit seeded listings.

## UX/UI Enhancements
- Map clustering + heatmap for browse; location-aware suggestions.
- Rich property detail: availability calendar, similar listings, host card with response time and trust markers.
- Discovery chips: business/family/creative, budget sliders, near-transit filter.
- Speed: optimistic UI for save/viewings, skeletons, offline/PWA for saved searches.
- Visual polish: stronger typography pairing, micro-animations on cards, staggered reveal, refreshed map theme.
- Upload UX: add success toast on media upload; keep compress-to-webp; consider background upload queue.
- Maps: add blur placeholder for Leaflet tiles.
- SEO/Sharing: per-property meta/OG tags, JSON-LD (Apartment/House/Product) with price/beds/amenities, dynamic sitemaps, canonical URLs, and similar-listings/internal linking to reduce thin content.
- Trust: surface power/Internet/water reliability, verified host/listing markers, and transparent pricing (fees/deposits).
- Messaging: quick replies + templated FAQs; collaborative shareable links for roommates/family.
- Media: optional 3D/VR tour embeds (Matterport), AI staging/cleanup for images.
- Financials: multi-gateway payments (M-PESA/Paga/Flutterwave), escrow/deposit handling, simple income/expense reporting.

## AI/Assist (Optional)
- AI description rewrite for hosts; AI search (natural language) for tenants.
- AI similar listings suggestions.
- AI-assisted intent search with mood chips (business/family/creative/remote) feeding filters.
- AI-powered tenant screening/matching (risk scoring; owner-visible only, privacy-safe).
- Dynamic pricing recommendations based on demand/seasonality/amenities; demand heatmaps on map.
- Fraud detection: behavioral signals + ID verification; verified listing badges.

## Observability
- Add simple logging for API fetch failures (env/URL, status) and image load errors.
- Health check endpoint for Supabase connectivity.
- Add 4xx/5xx alerts in Vercel; log storage upload failures for diagnostics.
- Add storage/media error logging and alerting for upload failures.
- If adding pricing/screening services, run them as separate services with event/queue logging and circuit breakers.
