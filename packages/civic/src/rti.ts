/**
 * RTI assistant: drafts a Right to Information Act, 2005 application for the
 * records that establish accountability for an asset — work order,
 * contractor, DLP clause, quality reports. Prepare, don't submit: the
 * citizen files (online where a verified portal exists, by post otherwise)
 * and tracks the statutory 30-day clock here.
 */
import type { AgencyPortal, CivicAgency } from "./agencies";
import { ISSUE_TYPES, type IssueType } from "./issues";
import type { CivicIssue } from "./types";
import { dlpStatusOf, type CivicWork } from "./works";

/** Section 7(1), RTI Act 2005: information within 30 days of receipt. */
export const RTI_RESPONSE_DAYS = 30;

/** Standard application fee under the central RTI Rules. */
export const RTI_FEE_INR = 10;

/**
 * Verified online filing portals (July 2026). Central portal covers central
 * public authorities (NHAI, NRIDA); Maharashtra runs its own for state
 * departments and major ULBs. Other states: file by post or in person with
 * the agency's PIO — we never invent a portal.
 */
export const RTI_PORTAL_CENTRAL: AgencyPortal = {
  name: "RTI Online (Central Government)",
  url: "https://rtionline.gov.in/",
};

export const RTI_PORTAL_MAHARASHTRA: AgencyPortal = {
  name: "RTI Online Maharashtra",
  url: "https://rtionline.maharashtra.gov.in/",
  helpline: "1800-120-8040",
};

/** Where this agency's RTI can be filed online; null = post/in-person. */
export function rtiPortalFor(agency: CivicAgency | null): AgencyPortal | null {
  if (!agency) return null;
  if (agency.kind === "nhai" || agency.kind === "pmgsy")
    return RTI_PORTAL_CENTRAL;
  if (agency.state === "Maharashtra") return RTI_PORTAL_MAHARASHTRA;
  return null;
}

export type CivicRtiStatus =
  | "drafted"
  | "filed"
  | "responded"
  | "appealed"
  | "closed";

/** One tracked RTI filing (civic_rti_requests row). */
export interface CivicRtiRequest {
  id: string;
  userId: string;
  issueId: string | null;
  workId: string | null;
  agencySlug: string | null;
  applicationText: string | null;
  referenceNo?: string;
  status: CivicRtiStatus;
  filedAt?: string;
  responseDueAt?: string;
  createdAt: string;
}

export function rtiDueDate(filedAt: string | Date): Date {
  return new Date(
    new Date(filedAt).getTime() + RTI_RESPONSE_DAYS * 86_400_000,
  );
}

export interface RtiDraftContext {
  issue: Pick<CivicIssue, "issueType" | "lat" | "lng" | "roadRef">;
  agency: CivicAgency | null;
  /** Known work record — narrows the request to a specific contract. */
  work?: Pick<
    CivicWork,
    "title" | "workOrderNo" | "contractorName" | "completionDate" | "dlpMonths"
  >;
  /** Optional; left as a signature placeholder when absent. */
  applicantName?: string;
  /** Clock injection for deterministic DLP wording (tests); defaults to now. */
  now?: Date;
}

/**
 * Application text under Section 6(1), RTI Act 2005. Facts and record
 * requests only. The information sought is the standard accountability set:
 * work order, contractor identity, DLP clause, completion certificate,
 * quality reports, payments, and complaint handling.
 */
export function draftRtiApplication(ctx: RtiDraftContext): string {
  const { issue, agency, work, applicantName, now = new Date() } = ctx;
  const def = ISSUE_TYPES[issue.issueType as IssueType];
  const lat = issue.lat.toFixed(6);
  const lng = issue.lng.toFixed(6);
  const where = issue.roadRef
    ? `${issue.roadRef} at coordinates ${lat}, ${lng}`
    : `coordinates ${lat}, ${lng}`;

  const scope = work?.workOrderNo
    ? `the work executed under work order no. ${work.workOrderNo}${work.title ? ` ("${work.title}")` : ""}`
    : `the most recent construction / repair / maintenance work covering the location ${where}`;

  const dlpNote =
    work && dlpStatusOf(work, now) === "inside"
      ? `\n\nNote: as per the site records available to me, the defect liability period for this work has not yet expired.`
      : "";

  const items = [
    `Certified copy of the work order and contract agreement for ${scope}, including the schedule of work and technical specifications.`,
    `Name and registered address of the contractor / executing agency, and the tender reference under which the contract was awarded.`,
    `The defect liability / guarantee clause of the said contract, the defect liability period, and its start and end dates.`,
    `Certified copy of the completion certificate, the recorded date of completion, and the final measured cost of the work.`,
    `Copies of quality-control and third-party audit test reports for the said work.`,
    `Details of payments released to the contractor against the said work, including any amounts withheld.`,
    `Details of complaints received regarding defects at the said location, and the action taken, including any repair notices issued to the contractor under the defect liability clause.`,
  ];

  return (
    `To,\nThe Public Information Officer,\n${agency ? agency.name : "The public authority responsible for the location stated below"}\n\n` +
    `Subject: Application under Section 6(1) of the Right to Information Act, 2005 — records of works at ${where} (regarding: ${def.label.toLowerCase()})\n\n` +
    `Sir/Madam,\n\nUnder the Right to Information Act, 2005, I request the following information:\n\n` +
    items.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    dlpNote +
    `\n\nI state that I am a citizen of India. The prescribed application fee of ₹${RTI_FEE_INR} is remitted herewith. ` +
    `If any of the requested information is held by another public authority, I request transfer of this application under Section 6(3) of the Act.\n\n` +
    `Kindly provide the information within the period prescribed under Section 7(1) of the Act.\n\n` +
    `Yours faithfully,\n${applicantName ?? "(name and signature)"}`
  );
}
