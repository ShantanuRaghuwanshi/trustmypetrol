# JanSetu (जनसेतु) — formerly TrustMyPetrol

Crowd-sourced accountability for India, on one map: fuel-quality trust scores for
petrol pumps **and** civic infrastructure issues (potholes, drains, streetlights) —
geo-verified photo reports, agency routing, formal-grievance escalation
(CPGRAMS / OMC / municipal portals), RTI assistance, and contractor records with
defect-liability tracking.

See [docs/JANSETU-REBRAND-UI.md](docs/JANSETU-REBRAND-UI.md) for the rebrand and UI
plan (internal package names and store identifiers deliberately keep the legacy
`trustmypetrol`/`@tmp` names).

See [docs/MVP-ARCHITECTURE.md](docs/MVP-ARCHITECTURE.md) for the full architecture,
data model, trust-score maths, and build order.

The same pipeline is expanding to civic infrastructure (potholes, drainage,
streetlights) with agency routing and contractor accountability — see
[docs/CIVIC-INFRA-EXPANSION.md](docs/CIVIC-INFRA-EXPANSION.md) for the deep dive and
[docs/CIVIC-PHASE1.md](docs/CIVIC-PHASE1.md) for what's implemented.

## Repo layout

```
apps/
  web/        Next.js — SEO-indexable pump pages + map (acquisition surface)
  mobile/     Expo (React Native) — Android-first app with the report flow
packages/
  shared/     Types, zod schemas, signal vocabulary, trust-score maths
  civic/      Civic-infra domain: issue vocabulary, agency registry,
              jurisdiction resolver, duplicate-clustering rules
supabase/
  migrations/ Postgres + PostGIS schema, RLS policies, scoring view
  seed/       Pune pilot pump seed data (+ generated jurisdiction geometry)
scripts/      Local verification helpers + OSM importers
```

## Getting started

```sh
pnpm install

# run package tests
pnpm --filter @tmp/shared test
pnpm --filter @tmp/civic test

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
