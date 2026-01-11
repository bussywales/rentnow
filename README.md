# RENTNOW (MVP)

This repo hosts the RENTNOW web MVP built with Next.js (App Router), Tailwind, Supabase, OpenAI, and Leaflet.

The app lives in `web/`. See `web/README.md` for full setup steps, env vars, schema, and feature notes.

Project docs:
- Roadmap: `docs/ROADMAP.md`
- Releases: `docs/RELEASES.md` (see `web/docs/VERSIONS.md` for full detail)
- Beta operations: `web/docs/BETA.md`

Quick start:
```bash
cd web
# Node.js >=20.9.0 is mandatory (Node 14/16 failures are non-actionable).
npm install
cp .env.local.example .env.local   # fill Supabase + OpenAI values
npm run dev
```

Supabase schema and RLS starter policies: `web/supabase/schema.sql`.

GitHub remote: https://github.com/bussywales/rentnow
