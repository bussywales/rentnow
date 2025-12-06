# RENTNOW (MVP)

AI-first rental platform for the African market. This MVP is a web-only PWA built with Next.js (App Router), Supabase, Tailwind, OpenAI, and Leaflet.

## Version
- Current: 0.2.7 (2025-12-05)
- Highlights: live Supabase data enforced on browse/detail/dashboard (no mock fallbacks), host-aware API base + logging, Next images temporarily unoptimized to bypass Unsplash 404s (see CHANGELOG.md). New health check at `/api/health`; property detail now shows refined similar listings; Playwright e2e smoke tests + cleanup script + CI cleanup; saved properties show correct images.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Supabase (Auth, Postgres, Storage)
- Leaflet + OpenStreetMap
- OpenAI (chat completions)

## Project structure
```
app/                # Routes (home, auth, onboarding, dashboard, admin, properties)
app/api/            # Route handlers (AI, property search, messages, viewings)
components/         # UI + feature components (cards, forms, map, role guard)
lib/                # Supabase clients, auth helpers, types, mock data
supabase/schema.sql # DB + RLS starter script
```

## Getting started
1) Prereqs: Node 18+, npm.  
2) Install deps:
```bash
cd web
npm install
```
3) Env vars: copy `.env.local.example` -> `.env.local` and fill in (OpenAI is optional; AI routes return safe fallbacks if the key is missing):
```
NEXT_PUBLIC_SITE_URL=https://www.rentnow.space
SITE_URL=https://www.rentnow.space
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...                # server-side use
SUPABASE_ANON_KEY=...           # server-side use
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=property-images # required for uploads
OPENAI_API_KEY=sk-...                              # optional, enables AI routes
```
4) Database: run `supabase/schema.sql` in Supabase SQL editor. Enable RLS and add the sample policies (see comments).  
5) Storage: create a public bucket named `property-images` (or update the code to use your bucket name).  
6) Dev server:
```bash
npm run dev
```
7) Auth notes: email/password via Supabase. On first login, users land on `/onboarding` to pick role (tenant/landlord/agent). Profile data lives in `profiles` table keyed by `auth.users.id`.
8) Quality checks: `npm run lint` then `npm run build` (tolerates missing OpenAI key if AI routes aren't hit).

## Demo mode and fallbacks
- Browse/detail/dashboard now expect live Supabase data; they surface API errors instead of showing mock cards. Home still uses a few mock highlights for marketing if Supabase is absent.
- Nav auth state uses a Supabase session when configured; dashboard role pulls from the Supabase profile and falls back to `demo`.
- AI routes short-circuit when `OPENAI_API_KEY` is absent: search parsing returns default filters and description generation returns a templated summary.
- Protected routes (dashboard/admin/favourites) can be gated via the edge-friendly `/proxy/auth` helper once Supabase is set.

## AI endpoints
- `POST /api/ai/generate-description` - body: property details; returns a 120-200 word marketing description. Uses `gpt-4.1-mini`.
- `POST /api/ai/parse-search` - body: `{ query: string }`; returns structured filters `{ city, minPrice, maxPrice, currency, bedrooms, rentalType, furnished, amenities[] }`.

## Core API (App Router handlers)
- Properties: `POST /api/properties` (create, attaches owner via auth), `PUT /api/properties/:id`, `DELETE /api/properties/:id`, `GET /api/properties/:id`, `GET /api/properties/search`.
- Messages: `GET/POST /api/messages` (auth required for POST; sender inferred from session).
- Viewing requests: `POST /api/viewings` (auth tenant inferred from session).

## Maps
Leaflet + OpenStreetMap via `PropertyMap` component. Works client-side only; ensure coordinates exist when rendering markers.

## Supabase schema (summary)
Tables: `profiles`, `properties`, `property_images`, `saved_properties`, `messages`, `viewing_requests`. Enums: `user_role`, `rental_type`, `viewing_status`. See `supabase/schema.sql` for indexes and starter RLS policies.

## Deployment
- Vercel for the Next.js app (add env vars in project settings).
- Required envs for prod: `NEXT_PUBLIC_SITE_URL`, `SITE_URL` (optional), Supabase URL/keys, and bucket name. Optional `OPENAI_API_KEY` for AI routes.
- Supabase for DB/Auth/Storage (free tier). Allow `*.vercel.app` origins in Auth settings.
- Health: `/api/health` returns `{ ok, supabase, error? }` (use for uptime/alerting).
- Releases: tag deployments as `vX.Y.Z` after merging to `main` and bump `package.json`/`package-lock.json`. Example: `git tag v0.2.3 && git push origin v0.2.3`.
- E2E tests: Playwright with `npm run test:e2e` (env: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_USER_EMAIL`, `PLAYWRIGHT_USER_PASSWORD`; `PLAYWRIGHT_ALLOW_WRITE=true` to enable viewing requests).

## Current status
- UI scaffolding for all core flows (home, search, property detail, dashboard CRUD shell, messaging/viewings shell, admin). 
- Supabase + OpenAI helpers are wired; browse/detail/dashboard rely on live Supabase data and surface API errors if misconfigured.
- Storage uploads expect a bucket named `property-images`.
- Ready for data hookup, Storage uploads, and polishing RLS/role enforcement.

## Support
- Status & release notes: `/support`
- Runtime env check: `/api/debug/env`
- Contact: hello@rentnow.africa
