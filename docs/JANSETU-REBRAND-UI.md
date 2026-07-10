# JanSetu — Rebrand & UI Revamp Plan

TrustMyPetrol grew a second, larger half: civic infrastructure accountability
(Phases 1–5, see [CIVIC-INFRA-EXPANSION.md](CIVIC-INFRA-EXPANSION.md)). The fuel
brand no longer covers the product. This document is the plan of record for the
rename and the UI unification, and tracks what is already implemented.

## 1. The name: JanSetu (जनसेतु)

**"People's bridge."** The app is literally a bridge between citizens and the
bodies that answer to them — OMCs, municipal corporations, PWDs, NHAI,
contractors. Why it wins:

- **Covers everything** — fuel, roads, drains, RTI, contractors — without naming
  any one of them; the product can keep growing under it.
- **Hindi-first, all-India legible**; both words are pan-Indian (jan / setu), easy
  to say, easy to spell, works in Devanagari and Latin.
- **Gov-tech credibility with citizen energy**: "setu" carries public-works
  connotation (Setu Bharatam, Atal Setu) — fitting for an app about public works.

Tagline: **"आपका शहर, रिकॉर्ड पर — your city, on the record."**

### Renaming boundaries (what changes, what deliberately doesn't)

| Layer | Action |
|---|---|
| Display name, headers, store listing, web brand/metadata | ✅ JanSetu (done) |
| Brand colour system | ✅ Setu blue (done, see §3) |
| `expo.slug`, URL `scheme`, iOS `bundleIdentifier`, Android `package` | ❌ **Do not change** — breaks EAS project binding, deep links, and store identity. A store rename changes the *display* name only. |
| pnpm workspace names (`@tmp/*`), repo folder | ❌ Internal only; churn without user value. Rename the GitHub repo whenever convenient (redirects are automatic). |
| Domain | Acquire `jansetu.in` / `jansetu.app`; keep trustmypetrol.* redirecting. `NEXT_PUBLIC_SITE_URL` drives the web canonical. |

## 2. Information architecture — one app, one map, one report button

Principle: **a citizen has one relationship with the city, not two apps.** Fuel is
one more thing the city must answer for.

### Mobile (bottom tabs)

```
🏠 Home     One map, layered: pump trust scores + civic issue pins (+ works/DLP
            in a later pass). Layer chips: All · Pumps · Civic. City chips +
            search stay. ✅ implemented
📍 Pumps    Pump directory (unchanged inside)
🚧 Civic    Civic issues list + report card entry (unchanged inside)
📸 Report   UNIVERSAL entry — branches: civic issue / project board / fuel
            report (pick your pump). One habit: "see something → Report".
            ✅ implemented
👤 You      Activity across both domains: reports, complaints + SLA timers,
            RTI clocks. (fuel-only today → unify next pass)
```

### Web

- `/` pumps (SEO surface, unchanged) · `/civic` hub · shared JanSetu header/nav.
- Next pass: a `/` that leads with the city map and report cards, pumps one
  click deep — once civic content volume justifies the swap.

## 3. Design language

Modern-clean, credibility-first. The app's authority comes from evidence, so the
UI stays calm and lets the data carry the emotion.

| Token | Value | Use |
|---|---|---|
| `brand` (setu blue) | `#1B4F8A` | primary actions, active states, brand |
| `brand deep` | `#123A66` | pressed/dark variant |
| `amber` | `#E8A13D` | civic issue pins, "attention" accents (kept) |
| verdict good/warn/bad | unchanged | trust scores, SLA states |
| paper/card/ink/line | unchanged | surfaces |

- Same palette on web (CSS vars) and mobile (`lib/theme.ts`) — one token swap
  recolours the entire product. ✅ implemented
- **Mobile follows Material Design 3** (m3.material.io): `lib/theme.ts` carries
  the M3 tonal scheme seeded from setu blue, the MD3 type scale
  (display→label), shape scale (4–28 px), and elevation levels 1–3 — applied
  to the navigation bar, top app bars, and card surfaces. Hand-rolled typed
  tokens, no runtime dependency; `react-native-paper` (the canonical M3
  library) can be adopted later without changing the token values. ✅ implemented
- **Web** parallels it with a fluid full-width system (max 1440 px, clamp
  gutters), sticky glass header, full-bleed gradient hero aligned to the
  content grid, elevation/hover card system, and automatic dark mode via
  `prefers-color-scheme`. ✅ implemented
- Iconography: Ionicons (mobile) stays; bridge glyph 🌉 as interim logomark —
  proper logo is an asset task (icon.png / adaptive-icon / splash / favicon).

### UX rules the revamp enforces

1. **One report habit** — every capture flow (fuel, civic, board, confirm-fix) is
   camera-first, GPS-mandatory, same shutter, same chips. Users learn it once.
2. **Status is always a date, not an adjective** — SLA due dates, DLP end dates,
   RTI clocks. Numbers over vibes.
3. **Never a dead end** — every "not on record" state names the next action
   (file RTI, snap a board, escalate).
4. **Layers, not sections** — the map is the shared canvas; content types are
   toggles on it, not silos.

## 4. Migration phases

| Phase | Scope | Status |
|---|---|---|
| R1 | Brand shell: names, headers, metadata, colour tokens (both apps) | ✅ this session |
| R2 | Unified home map layers + universal Report tab | ✅ this session |
| R3 | Unified **You** tab: fuel + civic activity, SLA/RTI timers in one timeline; complaint/RTI push reminders | next |
| R4 | Web home swap (map + report cards first), JanSetu logo assets, splash/store screenshots, store listing copy | next |
| R5 | Onboarding (3 screens: see · report · escalate), Hindi localisation pass (strings already isolated per screen) | later |

## 5. Store note

Play listing: rename display to "JanSetu — civic & fuel accountability"; keep the
package id. Screenshots and feature graphic need regenerating after R4 assets.
`docs/PLAY-STORE.md` copy to be rewritten then.
