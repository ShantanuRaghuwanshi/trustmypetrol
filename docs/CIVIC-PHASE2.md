# Civic Infra — Phase 2 Implementation

Implements step 2 of [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md): **assisted
filing + token tracking + SLA timers**, plus the first civic UI on both apps.
Phase 1 ([CIVIC-PHASE1.md](CIVIC-PHASE1.md)) shipped the domain package, resolver, and
report pipeline; Phase 2 makes them usable end-to-end.

## What shipped

| Piece | Where |
|---|---|
| Escalation ladder, SLA timers, grievance draft generator | `packages/civic/src/complaint.ts` |
| Complaint payload schemas | `packages/civic/src/schemas.ts` |
| `civic_complaints` table, SLA trigger, RLS | `supabase/migrations/0008_civic_complaints.sql` |
| Mobile: civic store (live + offline) | `apps/mobile/lib/civicStore.tsx` |
| Mobile: report flow (camera → type → severity → submit) | `apps/mobile/app/civic/report.tsx` |
| Mobile: issue page with filing assistant | `apps/mobile/app/civic/issue/[id].tsx` |
| Mobile: Civic tab + amber issue pins on the home map | `app/(tabs)/civic.tsx`, `components/MapHome.tsx` |
| Web: civic data access (no seed fallback — real reports only) | `apps/web/lib/civicData.ts` |
| Web: `/civic` explorer + `/civic/issue/[id]` pages | `apps/web/app/civic/…` |
| Web: filing assistant | `apps/web/components/CivicComplaintAssistant.tsx` |
| Smoke tests: SLA trigger, immutability, escalation trail | `scripts/verify-migrations.sh` |

## The filing model — prepare, don't submit

No Indian grievance portal has a public filing API, and citizen-files is what keeps the
platform legally clean (same stance as fuel complaints). The flow:

```
issue page → draft (facts only: type, coordinates, report count, evidence)
  → deep link to the first verified rung of the ladder
      agency portal → state portal → CPGRAMS        (escalationLadder)
  → citizen files, pastes registration number back  ('drafted' → 'filed')
  → server stamps filed_at + 30-day sla_due_at      (trigger, client-immutable)
  → window lapses → one-tap escalate: current row marked 'escalated',
    new 'drafted' row on the next rung, linked via escalated_from
```

Design notes:

- **The 30-day window is CPGRAMS' published SLA.** For agency/state portals — which
  publish no uniform SLA — it is used as a *reminder default*, and the code documents it
  as a nudge window, not a claim about those portals' rules.
- **Ladder rungs are omitted when unverified.** An agency with no verified portal URL
  ladders straight to CPGRAMS; unresolved jurisdiction gets CPGRAMS only. No invented
  links, ever.
- **SLA integrity is server-side.** The `civic_complaints_sla` trigger sets
  `filed_at`/`sla_due_at` on the drafted→filed transition and makes them immutable after;
  RLS only allows inserting rows as `drafted`. Filing an issue also flips it to
  `in_progress` on the public map.
- **Drafts are facts only** — vocabulary label, coordinates + map link, crowd count,
  severity, verification status, and the safety-hazard paragraph for flagged types. The
  statutory-duty line appears only for ULBs; the 1033/Rajmargyatra line only for NH.
- **Offline mode stays honest.** Mobile without Supabase env keeps reports on-device,
  uses a documented nearest-metro heuristic for jurisdiction (PostGIS is authoritative
  live), and the web renders an empty state rather than fabricated issues.

## Verification

```sh
pnpm --filter @tmp/civic test        # 33 unit tests (adds ladder, SLA, draft, schema)
pnpm --filter @tmp/civic typecheck
pnpm --filter mobile typecheck
pnpm --filter web typecheck
pnpm db:verify                       # adds: SLA trigger, filed-metadata immutability,
                                     # issue in_progress flip, escalation trail
```

After `pnpm install` (links the new `@tmp/civic` workspace dep into both apps), run
`node scripts/import-boundaries.ts` if Phase 1's geometry seed hasn't been generated yet.

## Phase 3 (next)

Public pressure surface: SEO ward/city report cards, resolution-time leaderboards,
seasonal waterlogging map — plus the `resolved_confirmation` re-verification prompt,
which needs no schema work.
