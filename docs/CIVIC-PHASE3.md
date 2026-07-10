# Civic Infra — Phase 3 Implementation

Implements step 3 of [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md): the **public
pressure surface** — city report cards and leaderboards — plus the community
**resolution loop** ("is it actually fixed?") that Phase 1's schema anticipated.

## What shipped

| Piece | Where |
|---|---|
| Report-card maths (rates, medians, hotspots, category splits) | `packages/civic/src/stats.ts` |
| Reopen + community-confirmed resolution | `supabase/migrations/0009_civic_resolution.sql` |
| Web: `/civic/[city]` SEO report cards (8 metros) | `apps/web/app/civic/[city]/page.tsx` |
| Web: cross-city leaderboard on `/civic` | `apps/web/app/civic/page.tsx` |
| Mobile: "Fixed already? Confirm on the spot" flow | `apps/mobile/app/civic/report.tsx` (confirm mode), `issue/[id].tsx` |
| Smoke tests: 2-confirmer resolve, reopen-on-re-report | `scripts/verify-migrations.sh` |

## The resolution loop

The fake-closure problem in every govt portal: the agency marks "resolved", nobody
checks. Here resolution is *earned* and *revocable*:

```
issue open/in_progress
  → citizen taps "Fixed already?" → live photo + GPS at the spot
  → resolved_confirmation report (same capture rigour as a report)
  → 2 distinct confirmers (RESOLVED_CONFIRMATIONS_REQUIRED) → status 'resolved'
  → pothole comes back → any fresh report within the cluster radius
    REOPENS the same issue (status 'reopened', resolved_at cleared)
```

Clustering now considers resolved issues, so a recurring defect accumulates history on
one issue instead of spawning duplicates — that history (reopen count, recurrence) is
exactly what the Phase-5 contractor scorecards will consume.

## Report cards — honest numbers only

`packages/civic/src/stats.ts` is the single source of truth (mirroring how
`@tmp/shared` owns pump-score maths): open/resolved counts, resolution rate
(suppressed below `MIN_ISSUES_FOR_RATES = 5` — small-n percentages are noise), median
first-report→resolution days, safety-critical open count, category breakdowns,
recurring waterlogging hotspots (≥ 3 reports), and longest-pending issues.

City attribution is by proximity to the metro centre (`CITY_ASSIGNMENT_RADIUS_M`,
40 km, now shared by mobile/web/stats). **Ward-level cards are deliberately deferred**:
they need ward boundary geometry (municipal GIS / OSM `admin_level=9-10`, patchy in
Indian cities) — a data task noted on every report card rather than approximated
silently.

Pages: `/civic/pune` … `/civic/ahmedabad` are statically generated, in the sitemap,
and frame the data plainly as a community ledger, not an official statistic. Each card
names the ULB that answers for the city, with its verified portal and helpline.

## Verification

```sh
pnpm --filter @tmp/civic test        # 39 tests (adds stats + threshold mirrors)
pnpm --filter @tmp/civic typecheck   # + mobile + web typecheck
pnpm db:verify                       # adds: single confirmation ≠ resolved,
                                     # 2 confirmers → resolved + resolved_at,
                                     # re-report → reopened, no duplicate issue
```

## Phase 4 (next)

Accountability data: site display-board OCR ("snap the board"), RTI assistant
(pre-filled applications for work order / contractor / DLP clause), and the
asset→contract registry those feed — the inputs to Phase 5's DLP engine and contractor
scorecards.
