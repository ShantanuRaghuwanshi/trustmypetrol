# Civic Infra — Phase 5 Implementation

Implements the final step of the [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md)
build order: **contractor scorecards** — the public aggregation the whole pipeline was
built to feed — plus the ingestion tooling that scales the works registry beyond
board snaps.

## What shipped

| Piece | Where |
|---|---|
| Scorecard engine: name canonicalisation, coverage matching, aggregates | `packages/civic/src/contractors.ts` |
| Idempotent ingestion: unique `(source, source_ref)` | `supabase/migrations/0011_civic_works_ingest.sql` |
| Official-export ingestion tool (JSON/CSV → seed SQL) | `scripts/import-works.ts` |
| Web: `/civic/contractor/[slug]` public record pages | `apps/web/app/civic/contractor/[slug]/page.tsx` |
| Web: contractor records section on `/civic`, sitemap, issue-page links | `apps/web/app/civic/page.tsx`, `sitemap.ts` |

## The scorecard

"Contractor X: 4 works, 61 issues in coverage, 3 open inside DLP, 2 reopened after a
claimed fix." Computed in `contractorScorecards(works, issues)`:

- **Canonical identity:** `contractorSlug()` strips M/s prefixes, punctuation, and
  case so registry variants of one firm aggregate together; display keeps the
  first-seen original.
- **Coverage matching:** an issue counts toward a work when it falls inside the
  work's coverage circle; issues are deduplicated per contractor across works.
- **The headline number — `dlpLiableOpen`:** open issues inside a covering work's
  live DLP. Contractually the contractor's repair; these rank the leaderboard and
  boost sitemap priority.
- **`reopenedIssues`:** recurrences the community caught after a resolution — the
  quality signal no agency portal keeps.

**Defamation posture, stated on every page:** only verifiable records — sourced
contracts and geo-verified reports matched by distance. No grades, no editorial
labels, and an explicit disclaimer that proximity alone doesn't establish cause;
DLP terms are as per the contract on record.

## Scaling the registry: `scripts/import-works.ts`

Tender portals (eprocure.gov.in, mahatenders.gov.in) and OMMAS gate data behind
search forms and captchas, so bulk ingestion is **operator-driven, never scraped
blind**: a human exports award lists / OMMAS contract reports / RTI responses, the
tool validates every record (rejecting bad rows loudly — no silent fixes), and emits
`supabase/seed/0005_works.sql` with upserts on `(source, source_ref)` so re-imports
are safe. Sourcing workflows for each portal are documented in the script header.

## Verification

```sh
pnpm --filter @tmp/civic test        # 56 tests (slug canonicalisation, coverage,
                                     # DLP liability, ordering, small-n honesty)
pnpm --filter @tmp/civic typecheck   # + mobile + web typecheck
node scripts/import-works.ts x.csv   # validated end-to-end incl. reject path
pnpm db:verify                       # full civic pipeline smoke suite
```

## The complete pipeline

All five build-order phases are now implemented:

1. **Phase 1** — jurisdiction resolver + report flow (real OSM boundaries)
2. **Phase 2** — assisted filing, SLA timers, escalation ladders + mobile/web UI
3. **Phase 3** — city report cards, leaderboards, community resolution loop
4. **Phase 4** — works registry, board snaps, DLP engine, RTI assistant
5. **Phase 5** — contractor scorecards + ingestion tooling

A pothole report now travels: photo → agency routing → formal complaint with SLA →
escalation → community-verified closure → and lands as a permanent line on the
public record of whoever built the road.

Post-launch backlog: ward boundary data (ward-level report cards), on-device OCR
wired into the board parser, linear-asset geometry from tender chainage, media/RWA
PDF dossier export, and electoral-ward tagging for pre-election scorecards.
