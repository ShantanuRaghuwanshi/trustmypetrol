/**
 * Ingests works-contract records from OFFICIAL exports into the civic works
 * registry, writing supabase/seed/0005_works.sql (idempotent upserts on
 * (source, source_ref) — see migration 0011).
 *
 * Sourcing workflow (operator-driven; portals gate downloads behind search
 * forms and captchas, so records are exported by a human, never scraped
 * blind):
 *   - eProcurement award notices: eprocure.gov.in / mahatenders.gov.in →
 *     "Tenders by Status → Awarded" → export/transcribe → source=tender_portal,
 *     source_ref = tender ID.
 *   - OMMAS (PMGSY): omms.nic.in reports (contracts module) →
 *     source=ommas, source_ref = package number.
 *   - RTI responses: transcribe the work order → source=rti_response,
 *     source_ref = RTI registration number.
 *
 * Input: a JSON array (or CSV with a header row) of records:
 *   {
 *     "source": "tender_portal" | "ommas" | "rti_response",
 *     "source_ref": "2026_PMC_123456_1",          // required, unique per source
 *     "source_url": "https://mahatenders.gov.in/…", // optional
 *     "title": "Improvement of Baner Road …",       // required
 *     "agency_slug": "ulb-pune",                    // optional, must exist
 *     "contractor_name": "M/s …",                   // optional
 *     "cost_inr": 42500000,                         // optional, number
 *     "work_order_no": "PMC/RD/2024/0713",          // optional
 *     "start_date": "2024-02-15",                   // optional, ISO date
 *     "completion_date": "2025-02-14",              // optional, ISO date
 *     "dlp_months": 36,                             // optional, 1–600
 *     "lat": 18.5590, "lng": 73.7868,               // optional pair
 *     "coverage_radius_m": 800                      // optional, 10–10000
 *   }
 *
 * Every record is validated; invalid rows are rejected loudly (non-zero
 * exit), never silently "fixed" — this pipeline only ever carries real,
 * attributable records.
 *
 * Run: node scripts/import-works.ts <records.(json|csv)>
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = ["tender_portal", "ommas", "rti_response"] as const;
type Source = (typeof SOURCES)[number];

interface WorkRecord {
  source: Source;
  source_ref: string;
  source_url?: string;
  title: string;
  agency_slug?: string;
  contractor_name?: string;
  cost_inr?: number;
  work_order_no?: string;
  start_date?: string;
  completion_date?: string;
  dlp_months?: number;
  lat?: number;
  lng?: number;
  coverage_radius_m?: number;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const optQ = (s: string | undefined) => (s == null ? "null" : q(s));
const optN = (n: number | undefined) => (n == null ? "null" : String(n));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(raw: Record<string, unknown>, line: number): WorkRecord {
  const errors: string[] = [];
  const rec = raw as Partial<WorkRecord>;

  if (!SOURCES.includes(rec.source as Source))
    errors.push(`source must be one of ${SOURCES.join("|")}`);
  if (typeof rec.source_ref !== "string" || rec.source_ref.trim().length < 2)
    errors.push("source_ref is required");
  if (typeof rec.title !== "string" || rec.title.trim().length < 3)
    errors.push("title is required");
  for (const d of ["start_date", "completion_date"] as const) {
    const v = rec[d];
    if (v != null && !ISO_DATE.test(String(v)))
      errors.push(`${d} must be YYYY-MM-DD`);
  }
  if (rec.cost_inr != null && !(Number(rec.cost_inr) > 0))
    errors.push("cost_inr must be a positive number");
  if (
    rec.dlp_months != null &&
    !(Number.isInteger(rec.dlp_months) && rec.dlp_months >= 1 && rec.dlp_months <= 600)
  )
    errors.push("dlp_months must be an integer 1–600");
  const hasLat = rec.lat != null;
  const hasLng = rec.lng != null;
  if (hasLat !== hasLng) errors.push("lat and lng must be provided together");
  if (hasLat && (Math.abs(Number(rec.lat)) > 90 || Math.abs(Number(rec.lng)) > 180))
    errors.push("lat/lng out of range");
  if (
    rec.coverage_radius_m != null &&
    !(rec.coverage_radius_m >= 10 && rec.coverage_radius_m <= 10_000)
  )
    errors.push("coverage_radius_m must be 10–10000");

  if (errors.length) {
    throw new Error(`record ${line}: ${errors.join("; ")}`);
  }
  return rec as WorkRecord;
}

/** Minimal CSV reader (header row, double-quote escaping). */
function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c !== "")) rows.push(row); }

  const header = rows.shift();
  if (!header) return [];
  const numeric = new Set(["cost_inr", "dlp_months", "lat", "lng", "coverage_radius_m"]);
  return rows.map((r) =>
    Object.fromEntries(
      header.map((h, i) => {
        const v = r[i]?.trim() ?? "";
        if (v === "") return [h, undefined];
        return [h, numeric.has(h) ? Number(v) : v];
      }),
    ),
  );
}

function toSql(r: WorkRecord): string {
  const location =
    r.lat != null && r.lng != null
      ? `st_setsrid(st_makepoint(${r.lng}, ${r.lat}), 4326)::geography`
      : "null";
  return `insert into civic_works (agency_slug, title, contractor_name, cost_inr,
  work_order_no, start_date, completion_date, dlp_months, location,
  coverage_radius_m, source, source_ref, source_url)
values (${optQ(r.agency_slug)}, ${q(r.title.trim())}, ${optQ(r.contractor_name)},
  ${optN(r.cost_inr)}, ${optQ(r.work_order_no)}, ${optQ(r.start_date)},
  ${optQ(r.completion_date)}, ${optN(r.dlp_months)}, ${location},
  ${r.coverage_radius_m ?? 500}, ${q(r.source)}, ${q(r.source_ref.trim())}, ${optQ(r.source_url)})
on conflict (source, source_ref) where source_ref is not null
do update set
  agency_slug = excluded.agency_slug, title = excluded.title,
  contractor_name = excluded.contractor_name, cost_inr = excluded.cost_inr,
  work_order_no = excluded.work_order_no, start_date = excluded.start_date,
  completion_date = excluded.completion_date, dlp_months = excluded.dlp_months,
  location = excluded.location, coverage_radius_m = excluded.coverage_radius_m,
  source_url = excluded.source_url;`;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/import-works.ts <records.(json|csv)>");
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  const rawRecords: Record<string, unknown>[] = path.endsWith(".csv")
    ? parseCsv(text)
    : (JSON.parse(text) as Record<string, unknown>[]);

  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    console.error("No records found in input.");
    process.exit(1);
  }

  const records = rawRecords.map((r, i) => validate(r, i + 1));

  // duplicate refs within one import are operator errors — fail loudly
  const seen = new Set<string>();
  for (const r of records) {
    const key = `${r.source}:${r.source_ref}`;
    if (seen.has(key)) {
      console.error(`duplicate (source, source_ref) in input: ${key}`);
      process.exit(1);
    }
    seen.add(key);
  }

  const header = `-- Works registry records ingested from official exports.
-- GENERATED by scripts/import-works.ts on ${new Date().toISOString()} from ${path.split("/").pop()}
-- — do not edit by hand. Re-runnable: upserts on (source, source_ref).
-- ${records.length} records.
`;
  writeFileSync(
    "supabase/seed/0005_works.sql",
    `${header}\n${records.map(toSql).join("\n\n")}\n`,
  );
  const located = records.filter((r) => r.lat != null).length;
  console.log(
    `Wrote supabase/seed/0005_works.sql — ${records.length} records (${located} geolocated, ${records.length - located} without coordinates).`,
  );
}

main();
