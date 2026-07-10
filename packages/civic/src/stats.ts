/**
 * Report-card maths for the public pressure surface (city pages,
 * leaderboards). Pure functions over issue lists — the web app renders,
 * this module is the single source of truth for the numbers, mirroring how
 * @tmp/shared owns the pump-score maths.
 *
 * City attribution is by proximity to the metro centre (issues carry no
 * ward geometry yet — ward-level cards need ward boundary data, a Phase-4+
 * data task). Numbers are only ever computed from real reports.
 */
import { CITIES, distanceMeters, type CityName } from "@tmp/shared";
import {
  ISSUE_CATEGORIES,
  ISSUE_TYPES,
  type IssueCategory,
  type IssueType,
} from "./issues";
import type { CivicIssue } from "./types";

/**
 * Issues within this radius of a metro's centre count as that city's.
 * Shared by the mobile civic tab, the web explorer, and the report cards.
 */
export const CITY_ASSIGNMENT_RADIUS_M = 40_000;

/**
 * Community re-verification: an issue flips to resolved once this many
 * distinct reporters confirm the fix on the spot. Mirrored in
 * submit_civic_report() (0009_civic_resolution.sql).
 */
export const RESOLVED_CONFIRMATIONS_REQUIRED = 2;

/** A waterlogging issue this crowded is a recurring hotspot, not a one-off. */
export const HOTSPOT_MIN_REPORTS = 3;

export function issuesNearCity(
  issues: readonly CivicIssue[],
  city: CityName,
): CivicIssue[] {
  const c = CITIES.find((x) => x.name === city);
  if (!c) return [];
  return issues.filter(
    (i) =>
      distanceMeters(i.lat, i.lng, c.lat, c.lng) <= CITY_ASSIGNMENT_RADIUS_M,
  );
}

const OPEN_STATUSES = new Set(["open", "in_progress", "reopened"]);

export interface CityCivicStats {
  city: CityName;
  total: number;
  open: number;
  resolved: number;
  /** resolved / total; null below MIN_ISSUES_FOR_RATES (small-n honesty). */
  resolutionRate: number | null;
  /** Median days from first report to resolution; null without resolutions. */
  medianResolutionDays: number | null;
  safetyCriticalOpen: number;
  byCategory: Record<IssueCategory, { open: number; resolved: number }>;
  topTypes: { type: IssueType; count: number }[];
  /** Recurring waterlogging spots (≥ HOTSPOT_MIN_REPORTS, unresolved). */
  waterloggingHotspots: CivicIssue[];
  /** Longest-standing unresolved issues, oldest first. */
  oldestOpen: CivicIssue[];
}

/** Below this many issues, rates are noise — render counts, not percentages. */
export const MIN_ISSUES_FOR_RATES = 5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function cityStats(
  city: CityName,
  allIssues: readonly CivicIssue[],
): CityCivicStats {
  const issues = issuesNearCity(allIssues, city);
  const open = issues.filter((i) => OPEN_STATUSES.has(i.status));
  const resolved = issues.filter((i) => i.status === "resolved");

  const byCategory = Object.fromEntries(
    (Object.keys(ISSUE_CATEGORIES) as IssueCategory[]).map((c) => [
      c,
      { open: 0, resolved: 0 },
    ]),
  ) as CityCivicStats["byCategory"];
  const typeCounts = new Map<IssueType, number>();

  for (const i of issues) {
    const cat = ISSUE_TYPES[i.issueType].category;
    if (i.status === "resolved") byCategory[cat].resolved++;
    else if (OPEN_STATUSES.has(i.status)) byCategory[cat].open++;
    typeCounts.set(i.issueType, (typeCounts.get(i.issueType) ?? 0) + 1);
  }

  const resolutionDays = resolved
    .filter((i) => i.resolvedAt)
    .map(
      (i) =>
        (new Date(i.resolvedAt!).getTime() -
          new Date(i.firstReportedAt).getTime()) /
        86_400_000,
    )
    .filter((d) => d >= 0);

  return {
    city,
    total: issues.length,
    open: open.length,
    resolved: resolved.length,
    resolutionRate:
      issues.length >= MIN_ISSUES_FOR_RATES
        ? resolved.length / issues.length
        : null,
    medianResolutionDays: median(resolutionDays),
    safetyCriticalOpen: open.filter(
      (i) => ISSUE_TYPES[i.issueType].safetyCritical,
    ).length,
    byCategory,
    topTypes: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    waterloggingHotspots: open
      .filter(
        (i) =>
          i.issueType === "waterlogging" &&
          i.reportCount >= HOTSPOT_MIN_REPORTS,
      )
      .sort((a, b) => b.reportCount - a.reportCount),
    oldestOpen: [...open]
      .sort(
        (a, b) =>
          new Date(a.firstReportedAt).getTime() -
          new Date(b.firstReportedAt).getTime(),
      )
      .slice(0, 5),
  };
}

/** Stats for every pilot city — the cross-city leaderboard input. */
export function allCityStats(
  issues: readonly CivicIssue[],
): CityCivicStats[] {
  return CITIES.map((c) => cityStats(c.name, issues));
}
