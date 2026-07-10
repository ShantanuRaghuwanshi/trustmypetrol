/** Domain types for civic-infra reporting. DB shapes live in 0007_civic_infra.sql. */
import type { ReportStatus, Verification } from "@tmp/shared";
import type { AgencyKind, AgencySlug } from "./agencies";
import type { IssueSeverity, IssueType } from "./issues";

/** Lifecycle of a clustered issue (not of an individual report). */
export type CivicIssueStatus = "open" | "in_progress" | "resolved" | "reopened";

/**
 * `report` opens or reinforces an issue; `resolved_confirmation` is the
 * community re-verification flow ("is it actually fixed?") — accepted by the
 * schema now so the Phase-2 closure loop needs no migration.
 */
export type CivicReportKind = "report" | "resolved_confirmation";

/**
 * A deduplicated, mapped issue: what the public map and agency escalations
 * reference. Individual reports attach to exactly one issue.
 */
export interface CivicIssue {
  id: string;
  issueType: IssueType;
  status: CivicIssueStatus;
  /** Location of the first report; refined clustering centroid later. */
  lat: number;
  lng: number;
  agencyKind: AgencyKind | "unresolved";
  agencySlug: AgencySlug | null;
  /** NH ref when jurisdiction came from road geometry. */
  roadRef: string | null;
  reportCount: number;
  firstReportedAt: string; // ISO timestamp
  lastReportedAt: string;
  resolvedAt: string | null;
}

/** One citizen submission, always attached to an issue. */
export interface CivicReport {
  id: string;
  userId: string;
  issueId: string;
  kind: CivicReportKind;
  issueType: IssueType;
  description?: string;
  severity?: IssueSeverity;
  verification: Verification;
  lat: number;
  lng: number;
  accuracyM: number;
  reportedAt: string;
  status: ReportStatus;
}
