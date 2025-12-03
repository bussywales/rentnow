# RENTNOW (MVP)

AI-first rental platform for the African market. This MVP is a web-only PWA built with Next.js (App Router), Supabase, Tailwind, OpenAI, and Leaflet.

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
3) Env vars: copy `.env.local.example` → `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...                # server-side use
SUPABASE_ANON_KEY=...           # server-side use
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=property-images
OPENAI_API_KEY=sk-...
```
4) Database: run `supabase/schema.sql` in Supabase SQL editor. Enable RLS and add the sample policies (see comments).  
5) Storage: create a public bucket named `property-images` (or update the code to use your bucket name).  
6) Dev server:
```bash
npm run dev
```
7) Auth notes: email/password via Supabase. On first login, users land on `/onboarding` to pick role (tenant/landlord/agent). Profile data lives in `profiles` table keyed by `auth.users.id`.

## AI endpoints
- `POST /api/ai/generate-description` — body: property details; returns a 120–200 word marketing description. Uses `gpt-4.1-mini`.
- `POST /api/ai/parse-search` — body: `{ query: string }`; returns structured filters `{ city, minPrice, maxPrice, currency, bedrooms, rentalType, furnished, amenities[] }`.

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
- Supabase for DB/Auth/Storage (free tier). Allow `*.vercel.app` origins in Auth settings.

## Current status
- UI scaffolding for all core flows (home, search, property detail, dashboard CRUD shell, messaging/viewings shell, admin). 
- Supabase + OpenAI helpers are wired; falls back to mock data if Supabase isn’t configured.
- Ready for data hookup, Storage uploads, and polishing RLS/role enforcement.
