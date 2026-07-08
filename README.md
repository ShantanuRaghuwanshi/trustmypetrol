# TrustMyPetrol

Crowd-sourced, OMC-neutral fuel-quality reporting for India. Users file geo-verified,
photo-backed reports against petrol pumps, see aggregate trust scores on a map, and get
help escalating issues into formal grievances (CPGRAMS / OMC portals).

See [docs/MVP-ARCHITECTURE.md](docs/MVP-ARCHITECTURE.md) for the full architecture,
data model, trust-score maths, and build order.

## Repo layout

```
apps/
  web/        Next.js — SEO-indexable pump pages + map (acquisition surface)
  mobile/     Expo (React Native) — Android-first app with the report flow
packages/
  shared/     Types, zod schemas, signal vocabulary, trust-score maths
supabase/
  migrations/ Postgres + PostGIS schema, RLS policies, scoring view
  seed/       Pune pilot pump seed data
scripts/      Local verification helpers
```

## Getting started

```sh
pnpm install

# run shared-package tests
pnpm --filter @tmp/shared test

# web app (uses bundled seed data if no Supabase env is set)
pnpm --filter web dev          # http://localhost:3000

# mobile app
pnpm --filter mobile start     # Expo dev server; press `a` for Android

# verify DB migrations against real PostGIS (needs Docker)
pnpm db:verify
```

## Supabase setup (when moving past seed data)

1. Create a project at supabase.com, enable phone auth (OTP) + Google provider.
2. Apply migrations in `supabase/migrations/` in order (SQL editor or `supabase db push`).
3. Load `supabase/seed/0001_pune_pilot.sql`.
4. Set env:
   - `apps/web/.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Both apps fall back to bundled seed data when env vars are absent, so the UI is
fully explorable without a backend.
