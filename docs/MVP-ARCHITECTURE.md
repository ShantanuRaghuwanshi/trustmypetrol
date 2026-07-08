# TrustMyPetrol — MVP Architecture

Crowd-sourced, OMC-neutral fuel-quality reporting for India. Users file geo-verified,
photo-backed reports against specific petrol pumps, see aggregate trust scores on a map,
and get help filing formal grievances (CPGRAMS / OMC portals).

## Product pillars (v1)

1. **Geo-verified evidence** — photos taken live in-app, GPS-matched to the pump. This is the moat.
2. **Structured reports, not rants** — predefined signal categories, aggregated into a pump score. Defamation-safe by design.
3. **Complaint assistant** — pre-fills a formal grievance with dealer code + evidence, deep-links the user to pgportal.gov.in / OMC portal to submit themselves. No automated submission in v1.
4. **Blend-availability map** — which pumps sell E10/E20/E100 / premium non-E20. The daily-use hook that drives retention between complaints.

Explicitly **out of scope for v1**: Aadhaar auth, automated CPGRAMS submission, dealer
payments/ads, iOS+Android native duplication.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **Expo (React Native) + TypeScript, Expo Router** | One codebase for Android + iOS; first-class camera & location APIs; EAS handles builds/OTA updates. Android ships first (that's where the users are). |
| Web | **Next.js (App Router)** | Pump pages must be SEO-indexable ("<pump name> reviews" searches are the acquisition channel). Server-rendered pump pages + map. Shares types/API client with the app via a small shared package. |
| Backend | **Supabase** (Postgres + PostGIS, Auth, Storage, Edge Functions) | Solo-dev speed: phone OTP + Google SSO built in, row-level security, geospatial queries, signed photo uploads. Escape hatch: it's plain Postgres — migrate to dedicated infra later without a rewrite. |
| Monorepo | pnpm workspaces + Turborepo | `apps/mobile`, `apps/web`, `packages/shared` (types, zod schemas, API client). |

## Data model

```
users
  id, phone (unique, verified), google_id?, display_name, created_at
  trust_level int  -- 0 new, 1 verified reporter (3+ geo-verified reports), 2 power user
  is_banned bool

pumps
  id, omc enum('IOCL','BPCL','HPCL','NAYARA','JIO_BP','SHELL','OTHER')
  dealer_code text        -- from OMC locator; key for formal complaints
  name, address, district, state
  location geography(point)          -- PostGIS
  blends jsonb            -- {e20: true, e10: false, e100: false, premium: true}, crowd-updated
  status enum('active','closed','unverified')
  claimed_by uuid? -> dealer_accounts

reports
  id, user_id -> users, pump_id -> pumps
  signals text[]          -- from fixed vocabulary, see below
  free_text text?         -- optional, length-capped, moderated before public display
  odo_km int?, litres numeric?, amount_inr numeric?   -- optional fill details
  verification enum('geo_verified','location_mismatch','unverified')
  reported_at timestamptz, device_lat/lng, distance_to_pump_m numeric
  status enum('published','pending_moderation','removed')

report_photos
  id, report_id -> reports
  storage_path, sha256, captured_at timestamptz (server-received time)
  device_lat/lng, mock_location_flag bool, exif_stripped bool

complaints
  id, user_id, pump_id, report_id?
  channel enum('cpgrams','omc_portal','other')
  reference_no text?      -- user pastes CPGRAMS registration number
  status enum('drafted','filed','responded','closed'), filed_at, last_nudged_at

dealer_accounts
  id, pump_id, contact info, verification_doc_path, verified bool
  -- claimed pumps can post one public response per report

pump_scores (materialized view, refreshed on report insert)
  pump_id, report_count_90d, geo_verified_ratio,
  signal_counts jsonb, trust_score numeric  -- see scoring
```

### Signal vocabulary (the defamation firewall)

Reports select from fixed, observable signals — never free-form accusations:

- `mileage_drop` — noticeable km/l drop after filling here
- `engine_trouble` — rough idle / hard start / stalling after filling
- `short_fuelling` — dispensed quantity looked short vs. display
- `meter_issue` — meter not zeroed / jumped
- `density_check_refused` — staff refused the density/5-litre test
- `no_e20_labelling` — blend labelling missing or unclear
- `overcharge` — charged above board price
- `good_experience` — positive signal (yes, these matter for the score)
- `blend_update` — pump now stocks / stopped stocking a blend (feeds `pumps.blends`)

Free text is optional, capped (~500 chars), auto-moderated (LLM pass for defamatory
phrasing / PII / abuse) before public display. Score maths never uses free text.

### Trust score

Per pump, over a rolling 90 days:

```
trust_score = 100 × (1 − weighted_negative_ratio)
weight(report) = base 1.0
  × 1.5 if geo_verified
  × 1.25 if reporter trust_level ≥ 1
  × recency decay (half-life 30 days)
  × dampening: max 1 counted report per user per pump per 7 days
```

Pumps with < 5 weighted reports show "Not enough data" instead of a score — no pump
gets tarred by one angry review.

## Photo verification pipeline

1. **Capture**: in-app camera only (`expo-camera`) — no gallery picker on the report flow.
2. **At capture**, record: device GPS fix (+accuracy), Android `isMockLocation` flag, timestamp.
3. **Upload** via short-lived signed URL to Supabase Storage; server records received-at time and computes sha256.
4. **Edge Function verifies**: distance(device GPS, pump location) ≤ 150 m AND capture-to-upload gap ≤ 10 min AND no mock-location flag → `geo_verified`. Otherwise the report still publishes as `unverified` (lower score weight) — never silently discard.
5. **Strip EXIF** before public serving (reporter privacy); keep originals in a private bucket as evidence.
6. **Phase 2 hardening**: Play Integrity API / iOS DeviceCheck attestation, perceptual-hash dedup to catch re-submitted photos.

## Complaint assistant flow

1. User taps "File formal complaint" on their published report.
2. App generates grievance text from a template: pump name, dealer code, OMC, date/time, selected signals, and links to the (private, evidence-bucket) photos packaged as a downloadable ZIP the user can attach.
3. Chooser: **CPGRAMS** (pgportal.gov.in, routed to MoPNG) or the **OMC's own portal** (IOCL/BPCL/HPCL each have one). Copy-to-clipboard + open-link; a short "what happens next" explainer.
4. User pastes back their registration number → app tracks it and nudges after 30 days ("CPGRAMS target resolution is 30 days — check status / escalate to DPG").

No credentials touched, no automated submission — the citizen files, we prepare. Formal
DARPG API access is a post-traction conversation.

## Seed data

- OMC pump locators (IOCL/BPCL/HPCL publish dealer lists with codes + coordinates). Respect ToS: prefer official downloadable lists / RTI-sourced datasets on data.gov.in over scraping. Seed one pilot city/state first, not all of India.
- Every seeded pump gets a page (SEO) with "No reports yet — be the first".

## Auth & abuse

- **Phone OTP is the primary identity** (one account per number = spam floor), Google SSO as convenience linking. No Aadhaar in v1 (legal risk, zero user benefit).
- Rate limits: 1 counted report / pump / user / 7 days; 5 reports / user / day.
- New accounts (< 3 geo-verified reports) get lower score weight — brigading a pump requires many aged, phone-verified accounts physically near it.
- Dealer right-of-reply on claimed pumps; takedown/appeal flow with human review.

## Build order

1. **Week 1–2**: monorepo scaffold, Supabase schema + RLS, seed pilot-city pumps, Next.js pump pages + map (read-only).
2. **Week 3–4**: Expo app — auth, map/list, pump page, report flow with camera + geo-verification Edge Function.
3. **Week 5**: scores, moderation queue, complaint assistant.
4. **Week 6**: dealer claim flow, polish, closed beta in pilot city.

Phase 2 candidates: mileage tracker (fill log + km/l trends), device attestation,
Hindi + regional language UI, DARPG/API integration, iOS release.
