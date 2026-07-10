/**
 * Assisted filing for civic issues: we prepare everything — the draft, the
 * right portal, the escalation ladder, the SLA reminder — and the citizen
 * presses the button. Same "prepare, don't submit" stance as fuel
 * grievances (no government portal here has a public filing API, and
 * citizen-files is also what keeps it legally clean).
 */
import type { CivicAgency } from "./agencies";
import { CPGRAMS_PORTAL, type AgencyPortal } from "./agencies";
import { ISSUE_TYPES, type IssueType } from "./issues";
import type { CivicIssue, CivicReport } from "./types";

/** Where a civic complaint is filed. Ladder order: agency → state → CPGRAMS. */
export type CivicComplaintChannel =
  | "agency_portal"
  | "state_portal"
  | "cpgrams";

export type CivicComplaintStatus =
  | "drafted"
  | "filed"
  | "responded"
  | "escalated"
  | "closed";

export interface CivicComplaint {
  id: string;
  userId: string;
  issueId: string;
  reportId?: string;
  channel: CivicComplaintChannel;
  agencySlug: string | null;
  referenceNo?: string;
  status: CivicComplaintStatus;
  filedAt?: string; // ISO timestamp
  slaDueAt?: string;
  /** Set when this complaint escalates an earlier one up the ladder. */
  escalatedFrom?: string;
  createdAt: string;
}

/**
 * CPGRAMS' published service-level agreement (Reform Programme 2022):
 * 30 days to resolution, with appeals thereafter. We also use it as the
 * reminder default for agency/state portals, which publish no uniform SLA —
 * it is a nudge window, not a claim about the portal's own rules.
 */
export const CPGRAMS_SLA_DAYS = 30;

export function slaDueDate(filedAt: string | Date): Date {
  return new Date(
    new Date(filedAt).getTime() + CPGRAMS_SLA_DAYS * 86_400_000,
  );
}

export function isSlaLapsed(filedAt: string | Date, now = new Date()): boolean {
  return now.getTime() > slaDueDate(filedAt).getTime();
}

export interface EscalationStep {
  channel: CivicComplaintChannel;
  portal: AgencyPortal;
}

/**
 * The filing ladder for an issue's agency. Steps whose portal URL we could
 * not verify are omitted (never a dead or invented link); CPGRAMS is always
 * the final rung — and the only rung when jurisdiction is unresolved.
 */
export function escalationLadder(agency: CivicAgency | null): EscalationStep[] {
  const steps: EscalationStep[] = [];
  if (agency?.portal?.url) {
    steps.push({ channel: "agency_portal", portal: agency.portal });
  }
  if (agency?.escalation?.url) {
    steps.push({ channel: "state_portal", portal: agency.escalation });
  }
  steps.push({ channel: "cpgrams", portal: CPGRAMS_PORTAL });
  return steps;
}

/** The rung after `current`, or null at the top of the ladder. */
export function nextEscalation(
  current: CivicComplaintChannel,
  agency: CivicAgency | null,
): EscalationStep | null {
  const ladder = escalationLadder(agency);
  const idx = ladder.findIndex((s) => s.channel === current);
  return idx >= 0 && idx + 1 < ladder.length ? ladder[idx + 1]! : null;
}

/* ── Draft generation ────────────────────────────────────────────────────── */

export interface CivicGrievanceContext {
  issue: Pick<
    CivicIssue,
    | "issueType"
    | "lat"
    | "lng"
    | "roadRef"
    | "reportCount"
    | "firstReportedAt"
    | "lastReportedAt"
  >;
  /** The filer's own report when available — adds severity and evidence. */
  report?: Pick<
    CivicReport,
    "description" | "severity" | "verification" | "accuracyM"
  >;
  agency: CivicAgency | null;
}

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  });

/**
 * Draft grievance text the user copies into the agency portal / CPGRAMS.
 * Facts only — issue type, precise location, report counts, evidence status.
 * The vocabulary keeps it observable; no accusations, no invented details.
 */
export function draftCivicGrievance(ctx: CivicGrievanceContext): string {
  const { issue, report, agency } = ctx;
  const def = ISSUE_TYPES[issue.issueType as IssueType];
  const lat = issue.lat.toFixed(6);
  const lng = issue.lng.toFixed(6);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const where = issue.roadRef
    ? `on ${issue.roadRef}, at coordinates ${lat}, ${lng}`
    : `at coordinates ${lat}, ${lng}`;

  const crowd =
    issue.reportCount > 1
      ? `This condition has been reported ${issue.reportCount} times by citizens between ${dateIN(issue.firstReportedAt)} and ${dateIN(issue.lastReportedAt)}.`
      : `This condition was reported on ${dateIN(issue.firstReportedAt)}.`;

  const severity =
    report?.severity != null
      ? ` The reporter assessed it as ${report.severity}.`
      : "";

  const detail = report?.description?.trim()
    ? `\n\nReporter's description: "${report.description.trim()}"`
    : "";

  const evidence =
    report?.verification === "geo_verified"
      ? `Geo-tagged photographic evidence is available; the capture location was device-verified (GPS accuracy ${Math.round(report.accuracyM)} m).`
      : "Photographic evidence is available.";

  const hazard = def.safetyCritical
    ? "\n\nThis is an immediate public-safety hazard. I request that the site be barricaded/made safe forthwith, ahead of permanent rectification."
    : "";

  const addressee = agency
    ? `the ${agency.name}`
    : "the authority responsible for this location";

  const duty =
    agency?.kind === "ulb"
      ? " Maintenance of public roads, drains, and streetlights within municipal limits is a statutory obligation of the corporation under its governing municipal legislation."
      : agency?.kind === "nhai"
        ? " This location lies on a National Highway; complaints may also be registered on the Rajmargyatra app or the 1033 highway helpline."
        : "";

  return (
    `Subject: ${def.label} ${where} — request for inspection and rectification\n\n` +
    `I wish to bring to the notice of ${addressee} a civic issue: ${def.label.toLowerCase()} (${def.hint.toLowerCase()}), located ${where} (map: ${mapsUrl}).\n\n` +
    `${crowd}${severity} ${evidence}${detail}${hazard}\n\n` +
    `I request that the site be inspected and the defect rectified, and that the work be carried out to the applicable IRC standards.${duty}\n\n` +
    `Kindly register this grievance and provide a registration/reference number and the expected timeline for resolution as per the applicable citizen charter.`
  );
}
