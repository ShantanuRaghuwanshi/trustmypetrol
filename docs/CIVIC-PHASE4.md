# Civic Infra — Phase 4 Implementation

Implements step 4 of [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md): the
**accountability data layer** — the asset→contract registry, the "snap the project
board" capture flow, the DLP engine, and the RTI assistant. This is the substrate
Phase 5's contractor scorecards will aggregate.

## What shipped

| Piece | Where |
|---|---|
| Works registry types + DLP engine + INR/board parsers | `packages/civic/src/works.ts` |
| RTI Act draft generator, verified portals, statutory clock | `packages/civic/src/rti.ts` |
| `civic_works`, board submissions, RTI tracker, `civic_works_near()` | `supabase/migrations/0010_civic_works.sql` |
| Mobile: board-snap capture + transcription flow | `apps/mobile/app/civic/board.tsx` |
| Mobile: accountability + RTI cards on the issue page | `apps/mobile/app/civic/issue/[id].tsx` |
| Web: accountability panel + RTI assistant on issue pages | `apps/web/app/civic/issue/[id]/page.tsx`, `components/RtiAssistant.tsx` |
| Smoke tests: coverage lookup, RTI clock immutability | `scripts/verify-migrations.sh` |

## The accountability chain

```
site display board (mandated: project, cost, dates, contractor)
  → citizen snaps it live (photo + GPS) and transcribes the fields
    (parseBoardText prefills from typed/OCR text — prefills, never invents)
  → civic_work_submissions (private, pending_review)
  → moderation promotes into civic_works (public registry; sources:
    display_board | rti_response | tender_portal | ommas)
  → every issue page asks civic_works_near(lat,lng): which contract
    covers this spot?
  → DLP engine: completion date + DLP months →
      inside  → "repair is the contractor's cost" badge, cited in the
                 grievance the citizen files
      expired → dated honestly
      unknown → the RTI below asks for exactly the missing records
  → RTI assistant: s.6(1) application drafted (work order, contractor,
    DLP clause, completion certificate, quality reports, payments),
    filed by the citizen (₹10), tracked against the statutory 30-day
    clock (s.7(1)) — stamped server-side, immutable after filing
```

Design notes:

- **No fabricated records, ever.** The registry only accepts sourced rows; board
  snaps stay private until reviewed; unknown fields render as "not on record" and
  the RTI is the documented path to fill them. `verified` marks rows cross-checked
  against a second source.
- **RTI portals are verified or absent.** Central agencies (NHAI, PMGSY) route to
  [rtionline.gov.in](https://rtionline.gov.in/); Maharashtra bodies to
  [rtionline.maharashtra.gov.in](https://rtionline.maharashtra.gov.in/) (helpline
  1800-120-8040). Other states: file with the PIO by post — no invented portals.
- **OCR posture:** the board parser is a pure text heuristic (labels → fields,
  crore/lakh normalisation, Indian date formats, DLP years→months). It runs on
  typed or pasted text today; wiring an on-device OCR library into the same
  parser is a drop-in enhancement, not a schema change.
- **Coverage model:** works carry a point (where the board stands) + a coverage
  radius (default 500 m). `civic_works_near` returns covering works nearest-first;
  issue pages use the closest. Linear-asset geometry (chainage → linestring) is a
  Phase-5 refinement fed by tender/OMMAS ingestion.

## Verification

```sh
pnpm --filter @tmp/civic test        # 51 tests (DLP engine, parsers, RTI drafts/portals)
pnpm --filter @tmp/civic typecheck   # + mobile + web typecheck
pnpm db:verify                       # adds: coverage-circle lookup hits/misses,
                                     # board snap pending_review, RTI 30-day stamp
                                     # + immutability
```

## Phase 5 (next)

Contractor scorecards: aggregate issues per contractor across their works
(reports, reopens, DLP-liable defects), public contractor pages, and the
tender-portal/OMMAS ingestion scrapers that scale the registry beyond board snaps.
