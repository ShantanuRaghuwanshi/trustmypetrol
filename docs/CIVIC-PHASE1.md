# Civic Infra — Phase 1 Implementation

Implements step 1 of the build order in [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md):
**jurisdiction resolver + pothole/drainage report flow**. No app UI yet — this phase is the
domain package, database layer, and real jurisdiction geometry.

## What shipped

| Piece | Where |
|---|---|
| Issue vocabulary (11 types, 4 categories) | `packages/civic/src/issues.ts` |
| Agency registry (8 ULBs, 7 state PWDs, NHAI, PMGSY) | `packages/civic/src/agencies.ts` |
| Jurisdiction precedence + capture verification | `packages/civic/src/resolver.ts` |
| Report payload schema (zod) | `packages/civic/src/schemas.ts` |
| DB schema, resolver, submit RPC, RLS | `supabase/migrations/0007_civic_infra.sql` |
| Real boundary/NH geometry importer | `scripts/import-boundaries.ts` |
| Smoke tests (resolver, clustering, rate limits) | `scripts/verify-migrations.sh` |

## Architecture

The design mirrors the fuel pipeline one-to-one; `packages/civic` is the single source of
truth for domain rules, with SQL mirrors marked by comments on both sides.

```
citizen capture (photo + GPS, mandatory)
        │  createCivicReportSchema (client validation)
        ▼
submit_civic_report()  — SECURITY DEFINER, the only write path
        ├─ classify_civic_capture()   mock/gap/accuracy → verification
        ├─ duplicate clustering       nearest open issue of same type within
        │                             the type's cluster radius → attach,
        │                             else create a new civic_issue
        └─ resolve_jurisdiction()     NH within 60 m → NHAI
                                      inside ULB polygon → that ULB
                                      within 25 km of a ULB → state PWD
                                      else → unresolved (never guessed)
```

Key decisions:

- **Reports attach to issues.** `civic_issues` is the deduplicated public map surface;
  `civic_reports` are individual submissions. Multiple reports on one issue are the
  crowd-severity signal, not spam. Rate limits: 10 reports/user/day, one report per user
  per issue per 24 h.
- **Capture is mandatory and server-classified.** Unlike pump reports there is no entity
  to match against — the capture location *is* the subject — so verification rests on
  mock-location flag, capture-to-upload gap (10 min, shared with fuel), and GPS accuracy
  (≤ 100 m). Clients can never self-verify, pick an agency, or choose an issue.
- **`resolved_confirmation` is schema-ready.** The Phase-2 community re-verification loop
  ("is it actually fixed?") needs no migration; the RPC already rejects confirmations
  with no open issue nearby.
- **The vocabulary is the defamation firewall**, same as fuel signals: reports select
  observable, photographable conditions — never accusations. Contractor attribution
  (Phase 2 DLP engine) will only ever see counts of these.
- **Reference data lives in tables** (`civic_issue_types`, `civic_agencies`), so new issue
  types and agencies ship as data. All portal URLs are real and source-verified (July
  2026); where a portal could not be verified the field is null and CPGRAMS
  (`pgportal.gov.in`) is the documented backstop — nothing is invented.

## Loading real jurisdiction geometry

Boundary tables ship empty; the resolver returns `unresolved` until real data is loaded.
Never hand-insert geometry.

```sh
node scripts/import-boundaries.ts     # needs network; Node 22 with --experimental-strip-types if <23.6
# review the generated supabase/seed/0004_boundaries.sql, then apply it
```

The script pulls each metro's municipal boundary from Nominatim (OSM relation polygons)
and NH-tagged ways from Overpass, caching responses in `.osm-cache/`. Data is
© OpenStreetMap contributors (ODbL) — attribute wherever displayed.

Known limitations, by design:

- **Delhi** falls back to the NCT boundary if the MCD relation is unavailable in OSM —
  this over-attributes NDMC/Cantonment areas to MCD; acceptable for the pilot, documented
  here, fix by loading the MCD relation when it stabilises.
- **PMGSY (rural roads) detection is deferred** until OMMAS road geometry is ingested
  (Phase 2); rural points resolve to the state PWD band or `unresolved`.
- Partial imports exit non-zero and log which cities were skipped.

## Verification

```sh
pnpm --filter @tmp/civic test        # 19 unit tests: vocabulary invariants, precedence,
                                     # capture classification, payload schema
pnpm --filter @tmp/civic typecheck
pnpm db:verify                       # Docker PostGIS: applies all migrations + seeds, then
                                     # smoke-tests resolver precedence, duplicate clustering,
                                     # rate limits, and rejection of orphan confirmations
```

Constants shared between TS and SQL (NH buffer 60 m, PWD band 25 km, accuracy 100 m,
cluster radii) are asserted in the unit tests and exercised in `db:verify`; both sides
carry mirror comments pointing at each other.

## Phase 2

✅ Implemented — assisted filing, token tracking, SLA timers, and the mobile + web civic
UI. See [CIVIC-PHASE2.md](CIVIC-PHASE2.md).
