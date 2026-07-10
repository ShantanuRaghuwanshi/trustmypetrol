import { describe, expect, it } from "vitest";
import {
  contractorScorecards,
  contractorSlug,
  issueCoveredByWork,
  type CivicIssue,
  type CivicWork,
} from "../src";

const NOW = new Date("2026-07-10T12:00:00Z");

let wSeq = 0;
function work(overrides: Partial<CivicWork> = {}): CivicWork {
  wSeq++;
  return {
    id: `w-${wSeq}`,
    agencySlug: "ulb-pune",
    title: `Work ${wSeq}`,
    contractorName: "M/s Example Infra Pvt Ltd",
    costInr: 10_000_000,
    workOrderNo: null,
    startDate: null,
    completionDate: "2025-06-01", // + 36 months → DLP live at NOW
    dlpMonths: 36,
    lat: 18.5204,
    lng: 73.8567,
    coverageRadiusM: 500,
    source: "display_board",
    sourceRef: null,
    sourceUrl: null,
    verified: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

let iSeq = 0;
function issue(overrides: Partial<CivicIssue> = {}): CivicIssue {
  iSeq++;
  return {
    id: `i-${iSeq}`,
    issueType: "pothole",
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

describe("contractorSlug", () => {
  it("canonicalises M/s prefixes, punctuation, and case", () => {
    expect(contractorSlug("M/s. Example Infra Pvt. Ltd.")).toBe(
      "example-infra-pvt-ltd",
    );
    expect(contractorSlug("EXAMPLE INFRA PVT LTD")).toBe(
      "example-infra-pvt-ltd",
    );
  });
});

describe("issueCoveredByWork", () => {
  it("matches inside the coverage circle, not outside or unlocated", () => {
    const w = work();
    expect(issueCoveredByWork(issue(), w)).toBe(true);
    expect(issueCoveredByWork(issue({ lat: 18.53, lng: 73.87 }), w)).toBe(
      false, // ~1.7 km away
    );
    expect(
      issueCoveredByWork(issue(), work({ lat: null, lng: null })),
    ).toBe(false);
  });
});

describe("contractorScorecards", () => {
  it("aggregates works and covered issues per canonical contractor", () => {
    const works = [
      work(),
      work({ contractorName: "EXAMPLE INFRA PVT LTD", costInr: null }),
      work({ contractorName: null }), // unattributable — excluded
    ];
    const issues = [
      issue(), // open, inside DLP coverage
      issue({ status: "reopened" }), // recurrence
      issue({ issueType: "open_manhole" }), // safety-critical
      issue({ status: "resolved", resolvedAt: "2026-06-20T00:00:00Z" }),
      issue({ lat: 19.076, lng: 72.8777 }), // Mumbai — not covered
    ];
    const cards = contractorScorecards(works, issues, NOW);
    expect(cards).toHaveLength(1);
    const c = cards[0]!;
    expect(c.slug).toBe("example-infra-pvt-ltd");
    expect(c.workCount).toBe(2);
    expect(c.knownCostInr).toBe(10_000_000); // null cost excluded from sum
    expect(c.issuesInCoverage).toBe(4);
    expect(c.openIssues).toBe(3);
    expect(c.reopenedIssues).toBe(1);
    expect(c.safetyCriticalOpen).toBe(1);
    expect(c.dlpLiableOpen).toBe(3); // all open issues sit inside a live DLP
  });

  it("no DLP liability when the period has lapsed or is unknown", () => {
    const lapsed = contractorScorecards(
      [work({ completionDate: "2020-01-01", dlpMonths: 12 })],
      [issue()],
      NOW,
    );
    expect(lapsed[0]!.dlpLiableOpen).toBe(0);
    const unknown = contractorScorecards(
      [work({ completionDate: null, dlpMonths: null })],
      [issue()],
      NOW,
    );
    expect(unknown[0]!.dlpLiableOpen).toBe(0);
    expect(unknown[0]!.openIssues).toBe(1); // still counted, just not DLP-liable
  });

  it("orders by live DLP liability, then open load", () => {
    const a = work({ contractorName: "Alpha Co" }); // DLP live
    const b = work({
      contractorName: "Beta Co",
      lat: 19.076,
      lng: 72.8777,
      completionDate: "2019-01-01",
      dlpMonths: 12,
    });
    const cards = contractorScorecards(
      [a, b],
      [issue(), issue({ lat: 19.076, lng: 72.8777 })],
      NOW,
    );
    expect(cards.map((c) => c.name)).toEqual(["Alpha Co", "Beta Co"]);
  });
});
