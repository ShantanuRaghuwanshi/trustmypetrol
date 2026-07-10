/**
 * Contractor scorecards: the Phase-5 aggregation over the works registry and
 * the issue map. "Contractor X: 4 works, 61 reports, 2 open defects inside
 * DLP."
 *
 * Defamation posture (same firewall as everywhere else): a scorecard is
 * only ever counts of verifiable records — sourced contracts and
 * photographed, geo-verified issue reports matched by distance. No grades,
 * no editorial labels; readers draw their own conclusions from facts.
 */
import { distanceMeters } from "@tmp/shared";
import { ISSUE_TYPES, type IssueType } from "./issues";
import type { CivicIssue } from "./types";
import { dlpStatusOf, type CivicWork } from "./works";

/**
 * Canonical key for a contractor name: strips the M/s prefix, punctuation,
 * and legal-suffix noise so "M/s. Example Infra Pvt. Ltd." and "example
 * infra pvt ltd" aggregate together. Display keeps the first-seen original.
 */
export function contractorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

/** Is the issue inside the work's coverage circle? */
export function issueCoveredByWork(
  issue: Pick<CivicIssue, "lat" | "lng">,
  work: Pick<CivicWork, "lat" | "lng" | "coverageRadiusM">,
): boolean {
  if (work.lat == null || work.lng == null) return false;
  return (
    distanceMeters(issue.lat, issue.lng, work.lat, work.lng) <=
    work.coverageRadiusM
  );
}

const OPEN_STATUSES = new Set(["open", "in_progress", "reopened"]);

export interface ContractorScorecard {
  slug: string;
  /** First-seen display name from the registry. */
  name: string;
  workCount: number;
  /** Sum of the costs on record; null when no work has a known cost. */
  knownCostInr: number | null;
  /** Agencies that awarded the works (slugs, deduplicated). */
  agencySlugs: string[];
  /** Distinct issues falling inside any of the contractor's works. */
  issuesInCoverage: number;
  openIssues: number;
  /** Reopened = the community caught a recurrence after resolution. */
  reopenedIssues: number;
  safetyCriticalOpen: number;
  /**
   * Open issues inside the DLP of a covering work — repairs that are, per
   * the contract on record, the contractor's cost.
   */
  dlpLiableOpen: number;
}

/**
 * Aggregate the registry + issue map into per-contractor scorecards.
 * Works without a contractor name on record are excluded (nothing to
 * attribute); issues can count toward multiple works but are deduplicated
 * per contractor.
 */
export function contractorScorecards(
  works: readonly CivicWork[],
  issues: readonly CivicIssue[],
  now: Date = new Date(),
): ContractorScorecard[] {
  const byContractor = new Map<
    string,
    { name: string; works: CivicWork[] }
  >();
  for (const w of works) {
    if (!w.contractorName) continue;
    const slug = contractorSlug(w.contractorName);
    if (!slug) continue;
    const entry = byContractor.get(slug) ?? {
      name: w.contractorName,
      works: [],
    };
    entry.works.push(w);
    byContractor.set(slug, entry);
  }

  const cards: ContractorScorecard[] = [];
  for (const [slug, { name, works: ws }] of byContractor) {
    const covered = new Map<string, { issue: CivicIssue; dlpLiable: boolean }>();
    for (const issue of issues) {
      for (const w of ws) {
        if (!issueCoveredByWork(issue, w)) continue;
        const isOpen = OPEN_STATUSES.has(issue.status);
        const dlpLiable = isOpen && dlpStatusOf(w, now) === "inside";
        const prev = covered.get(issue.id);
        covered.set(issue.id, {
          issue,
          dlpLiable: (prev?.dlpLiable ?? false) || dlpLiable,
        });
      }
    }
    const coveredList = [...covered.values()];
    const openList = coveredList.filter((c) =>
      OPEN_STATUSES.has(c.issue.status),
    );
    const costs = ws.filter((w) => w.costInr != null);

    cards.push({
      slug,
      name,
      workCount: ws.length,
      knownCostInr: costs.length
        ? costs.reduce((s, w) => s + (w.costInr ?? 0), 0)
        : null,
      agencySlugs: [
        ...new Set(ws.map((w) => w.agencySlug).filter((a): a is string => !!a)),
      ],
      issuesInCoverage: coveredList.length,
      openIssues: openList.length,
      reopenedIssues: coveredList.filter(
        (c) => c.issue.status === "reopened",
      ).length,
      safetyCriticalOpen: openList.filter(
        (c) => ISSUE_TYPES[c.issue.issueType as IssueType].safetyCritical,
      ).length,
      dlpLiableOpen: coveredList.filter((c) => c.dlpLiable).length,
    });
  }

  // Most accountability-relevant first: live DLP liabilities, then open load.
  return cards.sort(
    (a, b) =>
      b.dlpLiableOpen - a.dlpLiableOpen ||
      b.openIssues - a.openIssues ||
      b.workCount - a.workCount,
  );
}
