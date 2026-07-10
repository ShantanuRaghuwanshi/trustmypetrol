# Civic Infrastructure Expansion — Deep Dive

How TrustMyPetrol's core loop (geo-verified, photo-backed reports → aggregate trust scores → assisted escalation into official grievance channels) generalizes from petrol pumps to public infrastructure: potholes, drainage, streetlights, water, garbage — and, critically, **who was accountable** for each asset.

---

## 1. Why the model transfers

The pump-report pipeline is already category-agnostic:

| TrustMyPetrol concept | Civic-infra equivalent |
|---|---|
| Pump (fixed geo entity) | Road segment / drain / streetlight / ward asset |
| Signal vocabulary (short fuel, adulteration…) | Issue taxonomy (pothole, waterlogging, open manhole…) |
| Trust score per pump | "Infra health score" per ward / road / contractor |
| OMC + CPGRAMS escalation | ULB portal + Aaple Sarkar + CPGRAMS escalation |
| OMC-neutral stance | Agency-neutral: PMC vs PWD vs NHAI vs MSEDCL |

The differentiator vs every existing app (Section 3) is the same one you have vs OMC portals: **aggregation, public scorecards, and accountability tracing** — not just complaint intake.

---

## 2. Proposed features

### Tier 1 — Report & track (MVP extension)

- **Pothole reports**: photo + GPS + severity (size/depth estimate), auto-mapped to road segment. Duplicate clustering within N metres (multiple reports = severity signal, not spam).
- **Drainage / waterlogging**: choked drain, open manhole (safety-critical — flag for fast-track), sewage overflow, monsoon waterlogging spots. Seasonal recurrence tracking ("this spot floods every June") is a unique aggregate insight.
- **Streetlights, garbage black-spots, broken footpaths, encroachment** — same report primitive, different signal vocabulary.
- **Assisted filing**: pre-fill the complaint text and route to the correct authority (see Section 4 routing table). Store the official token number (PMC CMS token, Aaple Sarkar token, CPGRAMS 16-digit reg. no.) against the report so the user tracks everything in one place.
- **Status tracking + community verification**: authority marks "resolved" → nearby users get a "is it actually fixed?" prompt with photo re-verification. Closes the fake-closure loop that plagues Swachhata/ICMyC.

### Tier 2 — Accountability layer (the moat)

- **Asset → contract mapping**: for a road/drain, show which work order covers it, the contractor, cost, completion date, and **Defect Liability Period (DLP) status**. If a pothole appears inside DLP, the repair is the *contractor's* cost, not fresh taxpayer money — this is the single most powerful framing for a report.
- **Contractor scorecards**: aggregate issues per contractor across their works. "Contractor X: 4 roads, 61 pothole reports, 2 inside DLP."
- **RTI assistant**: when contract data isn't public, generate a ready-to-file RTI application (works ID, work order copy, contractor name, DLP clause, third-party quality-audit report) addressed to the PIO of the right ULB/PWD division. Publish returned RTI responses back into the asset database — crowdsourced contract registry.
- **Site display-board capture**: contractors are required to display project boards (name, cost, dates, contractor contact) at work sites. A "snap the board" flow + OCR seeds the asset→contractor database cheaply.
- **Escalation ladders**: ward engineer → ULB head → Aaple Sarkar (Maharashtra) → CPGRAMS appeal (5-level, 30-day SLA). Auto-remind users when an SLA lapses and one-tap escalate.

### Tier 3 — Public pressure surface

- **Ward/city report cards**: SEO-indexable pages (same play as pump pages) — "Potholes in Ward 23, Pune", monsoon waterlogging maps, resolution-time leaderboards per ward office.
- **Councillor/MLA tagging**: map every report to its electoral ward and constituency; pre-election scorecards.
- **Media/RWA export**: one-click PDF dossier of an issue (photos, timeline, token numbers, contract details, RTI responses) for journalists and resident welfare associations.

---

## 3. Existing alternatives (and their gaps)

| Platform | Owner / scope | What it does | Gap you exploit |
|---|---|---|---|
| [Swachhata-MoHUA](https://www.swachh.city/) | MoHUA, national (4,500+ ULBs) | Sanitation + civic complaints routed to city sanitary inspectors; feeds Swachh Survekshan scoring | Sanitation-centric; no contractor accountability; closure quality notoriously gamed |
| [CPGRAMS](https://pgportal.gov.in/) | DARPG, national | Universal grievance portal, 16-digit tracking, 30-day SLA, 5-level appeals, state integration | Intake only; no map, no aggregation, no public data; intimidating UX |
| [Meri Sadak](https://rural.nic.in/en/services/meri-sadak-pmgsy) | NRIDA, rural roads | Complaints on PMGSY/non-PMGSY roads, handled by State Quality Coordinators | Rural-road only; low awareness; no public outcomes |
| PWD Sewa (Delhi), similar state apps | State PWDs | Potholes, waterlogging, drains on PWD assets | Per-state silo; no cross-agency view |
| [PMC CARE](https://www.pmc.gov.in/en/initiatives/pmc-care-portal) / [complaint.pmc.gov.in](https://complaint.pmc.gov.in/home?language=en) | Pune Municipal Corp | Grievance intake incl. potholes, drainage, manholes | Your Pune pilot's direct target: no public map, no contractor link, resolution opaque |
| [I Change My City](https://www.ichangemycity.com/) (Janaagraha) | NGO, Bengaluru/Mumbai | Closest philosophical peer: ward-mapped complaints sent to civic engineers, ~2.4L complaints since 2012 | Largely Bengaluru; engagement decayed; no DLP/contractor layer; [their data is even openly published](https://data.opencity.in/dataset/i-change-my-city-data) |
| BBMP Fix My Street, BPAC Spotter | Bengaluru | Pothole reporting to ward engineers | City-specific, same gaps |
| FixMyStreet (mySociety, UK) | Open source | The original report-to-authority platform; codebase is reusable | Model to study; UK-centric routing |

**Positioning:** every govt app is an *intake funnel that protects the agency*. Nobody offers the citizen-side ledger: public, permanent, aggregated, contractor-attributed. That's the same wedge as TrustMyPetrol vs OMC portals.

---

## 4. Government systems, data sources, rules

### Complaint routing (where reports officially go)

| Asset owner | Portal | Notes |
|---|---|---|
| Municipal roads/drains (Pune) | PMC CMS / PMC CARE | First stop; capture token no. |
| Maharashtra state grievances | [Aaple Sarkar](https://grievances.maharashtra.gov.in) | Escalation when ULB stalls; needs prior token ref |
| State highways / PWD | [Maharashtra PWD grievance](https://pwd.maharashtra.gov.in/en/grievance-redressal/) | |
| National highways | NHAI Rajmargyatra app / 1033 helpline | NH potholes only |
| Rural (PMGSY) roads | Meri Sadak app | Handled by State Quality Coordinators |
| Anything, as appeal | [CPGRAMS](https://pgportal.gov.in/) | 30-day SLA, auto-routing, appeals; the universal backstop |

First engineering problem: **jurisdiction resolver** — given a lat/lng, which agency owns this road? (ULB limits → PMC; NH shapefile → NHAI; PMGSY via OMMAS; else PWD.) No govt app does this across agencies; it alone justifies the product.

### Contract / contractor data

- **[OMMAS](https://omms.nic.in/)** (PMGSY): the best public source — road-wise contractor, package, cost, completion, quality inspections for rural roads. Scrapeable per state/district.
- **State eProcurement portals** ([eprocure.gov.in](https://eprocure.gov.in), [mahatenders.gov.in](https://mahatenders.gov.in)): tender + award notices name the contractor and value. Award-notice scraping builds the works registry; Assam already publishes procurement in [OCDS format](https://data.open-contracting.org/en/publication/131) via CivicDataLab — a template for what to lobby other states for.
- **[data.gov.in](https://www.data.gov.in/keywords/Tender)**: assorted tender/works datasets, patchy but free.
- **ULB works budgets**: PMC publishes ward-wise capital works lists in budget documents (PDF scraping).
- **RTI Act 2005**: the gap-filler. Section 4 actually *obliges* proactive disclosure of works contracts; in practice you file RTIs for work order, contractor, DLP clause, and quality-audit reports. Responses become permanent public records in your DB.
- **Site display boards**: mandated project-info boards at work sites (project, cost, dates, contractor) — OCR-able ground truth.

### Rules that power the accountability framing

- **Defect Liability Period**: typically 2–5 yrs in municipal/state contracts; MoRTH has moved EPC highway DLP toward **10 years** ([Business Standard](https://www.business-standard.com/industry/news/govt-to-double-defect-liability-period-under-epc-contracts-to-10-yrs-124102301127_1.html)); activists (e.g. Sajag Nagrik Manch, Pune) document ULBs ignoring prescribed DLP norms. "Pothole inside DLP = contractor must fix free" is your headline mechanic.
- **IRC standards**: IRC SP:95 (maintenance contracts), IRC:82 (maintenance norms) define what "acceptable road condition" means — citable in complaints.
- **Municipal Corporation Acts** (e.g. Maharashtra Municipal Corporations Act): statutory duty to maintain roads/drains; basis for legal escalation.
- **Tort/writ jurisprudence**: courts (esp. Bombay HC's pothole suo-motu line of orders) have held civic bodies liable for pothole deaths/injuries — relevant for a "serious incident" report category ([overview](https://neetiniyaman.com/tort-liability-bad-roads-potholes-india/)).
- **CPGRAMS reform framework**: 30-day SLA, mandatory feedback, appeal levels — your SLA timers should mirror these officially published numbers.

---

## 5. Complaint post-and-track flow (proposed)

```
Citizen report (photo + GPS + category)
        │
        ▼
Jurisdiction resolver (PMC / PWD / NHAI / PMGSY)
        │
        ▼
Assisted filing → official portal → token stored
        │                              │
        ▼                              ▼
Public map pin + asset page      SLA timer (per portal norms)
        │                              │
        ▼                              ▼
Contract lookup (OMMAS /        SLA breach → one-tap escalate
eProc / RTI / board OCR)        (Aaple Sarkar → CPGRAMS appeal)
        │
        ▼
DLP check → "contractor-liable" badge → contractor scorecard
        │
        ▼
"Resolved" → community photo re-verification → real closure
```

---

## 6. Risks & realities

- **Scraping fragility**: eProc/OMMAS portals are hostile to automation; budget for per-state adapters and RTI as fallback.
- **Asset matching is hard**: mapping a lat/lng pothole to a specific work order is fuzzy (works are described by chainage/street names, not geometry). Start with major roads where boards/RTI give clean data; accept "unknown contractor" gracefully.
- **Defamation exposure**: contractor scorecards must show verifiable facts (report counts, contract records, RTI docs), never editorial accusations. Same moderation posture as pump trust scores.
- **Govt friction**: unlike OMCs, ULBs can block API-less intake (captchas on complaint portals). Assisted filing may need to be "copy this text + deep link" rather than headless submission.
- **Scope creep vs brand**: "TrustMyPetrol" doesn't stretch to drains. Likely a sibling brand on shared infra (e.g. the packages/shared trust-score engine becomes a generic "civic signal" engine).

---

## 7. Suggested build order

1. **Jurisdiction resolver + pothole/drainage report flow** — ✅ implemented, see [CIVIC-PHASE1.md](CIVIC-PHASE1.md) (`packages/civic`, migration `0007_civic_infra.sql`, `scripts/import-boundaries.ts`).
2. **Assisted filing for PMC CMS + Aaple Sarkar + CPGRAMS**, token tracking, SLA timers — ✅ implemented, see [CIVIC-PHASE2.md](CIVIC-PHASE2.md) (includes mobile + web UI).
3. **Ward report-card web pages** (SEO surface, reuse pump-page machinery) — ✅ implemented at city level (ward level awaits ward boundary data), plus the resolution loop; see [CIVIC-PHASE3.md](CIVIC-PHASE3.md).
4. **Display-board OCR + RTI assistant** → seed asset→contractor registry — ✅ implemented (board snap + transcription parser + works registry + RTI assistant), see [CIVIC-PHASE4.md](CIVIC-PHASE4.md).
5. **OMMAS + mahatenders scrapers** → DLP engine → contractor scorecards — ✅ implemented (operator-driven ingestion tool + scorecard engine + public contractor pages), see [CIVIC-PHASE5.md](CIVIC-PHASE5.md). **All five phases complete.**

---

## Sources

- [Swachhata-MoHUA app](https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat&hl=en_IN) · [Swachh City portal](https://www.swachh.city/)
- [CPGRAMS](https://pgportal.gov.in/) · [CPGRAMS FAQ](https://pgportal.gov.in/Home/Faq) · [CPGRAMS 2026 filing guide](https://righttoinformation.wiki/file-cpgrams-grievance-2026)
- [Meri Sadak (PMGSY)](https://rural.nic.in/en/services/meri-sadak-pmgsy) · [OMMAS](https://omms.nic.in/) · [PMGSY guidelines](https://omms.nic.in/ReferenceDocs/PMGSY_Guidelines.pdf)
- [PWD Sewa app, Delhi](https://www.india.com/news/india/complaints-regarding-potholes-waterlogging-in-delhi-can-be-directly-registered-using-pwd-sewa-app-check-how-to-file-complaint-monsoon-menace-rekha-gupta-8466290/)
- [PMC CARE](https://www.pmc.gov.in/en/initiatives/pmc-care-portal) · [PMC complaint portal](https://complaint.pmc.gov.in/home?language=en) · [Filing PMC complaints + Aaple Sarkar escalation](https://complainthub.org/pmc-pune/) · [Maharashtra PWD grievance](https://pwd.maharashtra.gov.in/en/grievance-redressal/)
- [I Change My City](https://www.ichangemycity.com/) · [ICMyC open data](https://data.opencity.in/dataset/i-change-my-city-data) · [Bengaluru complaint-resolution critique](https://citizenmatters.in/bengaluru-civic-issues-complaint-fix/)
- [EPC defect liability doubled to 10 years](https://www.business-standard.com/industry/news/govt-to-double-defect-liability-period-under-epc-contracts-to-10-yrs-124102301127_1.html) · [Sajag Nagrik Manch on ignored DLP norms](https://www.freepressjournal.in/mumbai/maharashtra-roads-sajag-nagrik-manch-alleges-civic-bodies-ignoring-defect-liability-norms-for-infrastructure-projects)
- [Pothole liability law overview](https://neetiniyaman.com/tort-liability-bad-roads-potholes-india/) · [IRC SP:95 model maintenance contract](https://law.resource.org/pub/in/bis/irc/irc.gov.in.sp.095.2011.pdf)
- [RTI for road works](https://rtiguru.com/form/road-work) · [data.gov.in tender datasets](https://www.data.gov.in/keywords/Tender) · [Assam OCDS procurement data](https://data.open-contracting.org/en/publication/131)
