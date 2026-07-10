/**
 * The asset→contract registry: works contracts covering a location, and the
 * Defect Liability Period (DLP) engine over them. A pothole inside a work's
 * DLP is the contractor's repair cost, not fresh taxpayer money — the single
 * most powerful framing a report can carry.
 *
 * Registry rows come only from real sources: transcribed site display
 * boards (photo-evidenced), RTI responses, tender-portal award notices, and
 * OMMAS. Unknown fields stay null and every consumer degrades honestly.
 */

/** Where a works record came from. Mirrored in 0010_civic_works.sql. */
export type WorkSource =
  | "display_board"
  | "rti_response"
  | "tender_portal"
  | "ommas";

export interface CivicWork {
  id: string;
  agencySlug: string | null;
  title: string;
  contractorName: string | null;
  costInr: number | null;
  workOrderNo: string | null;
  /** ISO dates (yyyy-mm-dd). */
  startDate: string | null;
  completionDate: string | null;
  dlpMonths: number | null;
  /** Reference point (e.g. where the display board stands); null = unknown. */
  lat: number | null;
  lng: number | null;
  /** Issues within this distance of the point are covered by the work. */
  coverageRadiusM: number;
  source: WorkSource;
  sourceRef: string | null;
  sourceUrl: string | null;
  /** True once cross-checked against a second source (RTI / tender record). */
  verified: boolean;
  createdAt: string;
}

export const DEFAULT_WORK_COVERAGE_RADIUS_M = 500;

/* ── DLP engine ──────────────────────────────────────────────────────────── */

export type DlpStatus = "inside" | "expired" | "unknown";

/** completion date + DLP months; null when either input is unknown. */
export function dlpEndDate(
  work: Pick<CivicWork, "completionDate" | "dlpMonths">,
): Date | null {
  if (!work.completionDate || work.dlpMonths == null) return null;
  const d = new Date(work.completionDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + work.dlpMonths);
  return d;
}

export function dlpStatusOf(
  work: Pick<CivicWork, "completionDate" | "dlpMonths">,
  now: Date = new Date(),
): DlpStatus {
  const end = dlpEndDate(work);
  if (!end) return "unknown";
  return now.getTime() <= end.getTime() ? "inside" : "expired";
}

/** "₹4.25 crore" / "₹25 lakh" / "₹12,500" — Indian-style compact amounts. */
export function formatInrCompact(n: number): string {
  const trim = (s: string) => s.replace(/\.?0+$/, "");
  if (n >= 1e7) return `₹${trim((n / 1e7).toFixed(2))} crore`;
  if (n >= 1e5) return `₹${trim((n / 1e5).toFixed(2))} lakh`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ── Display-board text parser ───────────────────────────────────────────── */

/**
 * Best-effort extraction from a project display board's text (typed in or
 * produced by on-device OCR). Boards are mandated to show project name,
 * cost, dates, and contractor. Pure heuristics: anything not matched stays
 * null and the citizen corrects the form — the parser prefills, never
 * invents.
 */
export interface ParsedBoard {
  contractorName: string | null;
  costInr: number | null;
  workOrderNo: string | null;
  startDate: string | null; // ISO yyyy-mm-dd
  completionDate: string | null;
  dlpMonths: number | null;
}

/** "12/04/2025", "12-4-25" → ISO; null when not a plausible date. */
function parseIndianDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy < 100) yyyy += 2000;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1990 || yyyy > 2100)
    return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** "₹ 4.5 crore", "Rs 25 lakh", "Rs. 12,50,000" → INR; null if unparsable. */
export function parseInrAmount(raw: string): number | null {
  const m = raw
    .replace(/,/g, "")
    .match(/(?:₹|rs\.?|rupees|inr)?\s*([\d.]+)\s*(crores?|cr\.?|lakhs?|lacs?|l\b)?/i);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("cr")) return n * 1e7;
  if (unit.startsWith("la") || unit === "l") return n * 1e5;
  return n;
}

function matchLine(text: string, labels: RegExp): string | null {
  // "Label : value" / "Label - value" on one line, case-insensitive.
  const re = new RegExp(
    `(?:${labels.source})\\s*[:\\-–]\\s*(.+)`,
    "im",
  );
  const m = text.match(re);
  const v = m?.[1]?.trim();
  return v && v.length > 1 ? v : null;
}

export function parseBoardText(text: string): ParsedBoard {
  const contractor = matchLine(
    text,
    /name of (?:the )?contractor|contractor|contract agency|agency name|executing agency/,
  );
  const costRaw = matchLine(
    text,
    /(?:estimated |project |tender |contract )?cost(?: of work)?|amount/,
  );
  const orderRaw = matchLine(text, /work order (?:no\.?|number)|w\.?o\.? no\.?/);
  const startRaw = matchLine(
    text,
    /date of (?:commencement|start)|start(?:ing)? date|commencement date/,
  );
  const endRaw = matchLine(
    text,
    /date of completion|completion date|stipulated date of completion/,
  );
  const dlpRaw = matchLine(
    text,
    /defect liability(?: period)?|dlp|guarantee period/,
  );

  let dlpMonths: number | null = null;
  if (dlpRaw) {
    const m = dlpRaw.match(/(\d+)\s*(years?|yrs?|months?)?/i);
    if (m && m[1]) {
      const n = Number(m[1]);
      const unit = (m[2] ?? "years").toLowerCase();
      dlpMonths = unit.startsWith("month") ? n : n * 12;
      if (dlpMonths <= 0 || dlpMonths > 600) dlpMonths = null;
    }
  }

  return {
    contractorName: contractor,
    costInr: costRaw ? parseInrAmount(costRaw) : null,
    workOrderNo: orderRaw ? (orderRaw.split(/\s/)[0] ?? null) : null,
    startDate: startRaw ? parseIndianDate(startRaw.split(/\s/)[0] ?? "") : null,
    completionDate: endRaw ? parseIndianDate(endRaw.split(/\s/)[0] ?? "") : null,
    dlpMonths,
  };
}
