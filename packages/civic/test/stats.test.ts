import { describe, expect, it } from "vitest";
import {
  cityStats,
  HOTSPOT_MIN_REPORTS,
  issuesNearCity,
  MIN_ISSUES_FOR_RATES,
  RESOLVED_CONFIRMATIONS_REQUIRED,
  type CivicIssue,
  type IssueType,
} from "../src";

/** Test fixture builder — coordinates around Pune's centre (18.5204, 73.8567). */
let seq = 0;
function issue(overrides: Partial<CivicIssue> = {}): CivicIssue {
  seq++;
  return {
    id: `i-${seq}`,
    issueType: "pothole" as IssueType,
    status: "open",
    lat: 18.5204,
    lng: 73.8567,
    agencyKind: "ulb",
    agencySlug: "ulb-pune",
    roadRef: null,
    reportCount: 1,
    firstReportedAt: "2026-06-01T00:00:00Z",
    lastReportedAt: "2026-06-01T00:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("issuesNearCity", () => {
  it("assigns by proximity and excludes far-away issues", () => {
    const inPune = issue();
    const inMumbai = issue({ lat: 19.076, lng: 72.8777 });
    expect(issuesNearCity([inPune, inMumbai], "Pune")).toEqual([inPune]);
    expect(issuesNearCity([inPune, inMumbai], "Mumbai")).toEqual([inMumbai]);
  });
});

describe("cityStats", () => {
  it("computes counts, category split, and safety-critical open", () => {
    const s = cityStats("Pune", [
      issue(),
      issue({ issueType: "open_manhole" }),
      issue({ issueType: "choked_drain", status: "in_progress" }),
      issue({
        status: "resolved",
        resolvedAt: "2026-06-11T00:00:00Z",
      }),
    ]);
    expect(s.total).toBe(4);
    expect(s.open).toBe(3);
    expect(s.resolved).toBe(1);
    expect(s.safetyCriticalOpen).toBe(1); // the open manhole
    expect(s.byCategory.roads).toEqual({ open: 1, resolved: 1 });
    expect(s.byCategory.drainage).toEqual({ open: 2, resolved: 0 });
  });

  it("median resolution time uses first-report → resolved", () => {
    const s = cityStats("Pune", [
      issue({ status: "resolved", resolvedAt: "2026-06-11T00:00:00Z" }), // 10 d
      issue({ status: "resolved", resolvedAt: "2026-07-01T00:00:00Z" }), // 30 d
      issue({ status: "resolved", resolvedAt: "2026-06-21T00:00:00Z" }), // 20 d
    ]);
    expect(s.medianResolutionDays).toBe(20);
  });

  it("suppresses rates below the small-n threshold, keeps counts", () => {
    const few = cityStats("Pune", [
      issue({ status: "resolved", resolvedAt: "2026-06-02T00:00:00Z" }),
      issue(),
    ]);
    expect(few.total).toBe(2);
    expect(few.resolutionRate).toBeNull();

    const enough = cityStats(
      "Pune",
      Array.from({ length: MIN_ISSUES_FOR_RATES }, (_, i) =>
        issue(
          i === 0
            ? { status: "resolved", resolvedAt: "2026-06-02T00:00:00Z" }
            : {},
        ),
      ),
    );
    expect(enough.resolutionRate).toBeCloseTo(1 / MIN_ISSUES_FOR_RATES);
  });

  it("surfaces recurring waterlogging hotspots and the oldest open issues", () => {
    const hotspot = issue({
      issueType: "waterlogging",
      reportCount: HOTSPOT_MIN_REPORTS,
    });
    const oneOff = issue({ issueType: "waterlogging", reportCount: 1 });
    const ancient = issue({ firstReportedAt: "2026-01-01T00:00:00Z" });
    const s = cityStats("Pune", [oneOff, hotspot, ancient]);
    expect(s.waterloggingHotspots).toEqual([hotspot]);
    expect(s.oldestOpen[0]).toEqual(ancient);
  });

  it("shares the confirmation threshold with the SQL mirror", () => {
    // If this changes, update submit_civic_report in 0009_civic_resolution.sql.
    expect(RESOLVED_CONFIRMATIONS_REQUIRED).toBe(2);
  });
});
