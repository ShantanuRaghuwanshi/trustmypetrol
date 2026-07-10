import { describe, expect, it } from "vitest";
import {
  AGENCIES,
  CPGRAMS_SLA_DAYS,
  createCivicComplaintSchema,
  draftCivicGrievance,
  escalationLadder,
  isSlaLapsed,
  nextEscalation,
  slaDueDate,
  trackCivicComplaintSchema,
  type CivicGrievanceContext,
} from "../src";

const NOW = new Date("2026-07-10T12:00:00Z");

// ── Escalation ladder ─────────────────────────────────────────────────────

describe("escalationLadder", () => {
  it("full ladder for an agency with portal + state escalation", () => {
    const ladder = escalationLadder(AGENCIES["ulb-pune"]);
    expect(ladder.map((s) => s.channel)).toEqual([
      "agency_portal",
      "state_portal",
      "cpgrams",
    ]);
    expect(ladder[0]!.portal.url).toBe("https://complaint.pmc.gov.in/");
    expect(ladder[2]!.portal.url).toBe("https://pgportal.gov.in/");
  });

  it("omits unverified rungs — never a dead or invented link", () => {
    // Karnataka PWD has no verified portal; ladder is CPGRAMS only.
    expect(
      escalationLadder(AGENCIES["pwd-karnataka"]).map((s) => s.channel),
    ).toEqual(["cpgrams"]);
    // MCD has a portal but no verified state portal.
    expect(
      escalationLadder(AGENCIES["ulb-delhi"]).map((s) => s.channel),
    ).toEqual(["agency_portal", "cpgrams"]);
  });

  it("unresolved jurisdiction gets the CPGRAMS backstop", () => {
    expect(escalationLadder(null).map((s) => s.channel)).toEqual(["cpgrams"]);
  });

  it("nextEscalation walks the ladder and stops at the top", () => {
    const pune = AGENCIES["ulb-pune"];
    expect(nextEscalation("agency_portal", pune)?.channel).toBe(
      "state_portal",
    );
    expect(nextEscalation("state_portal", pune)?.channel).toBe("cpgrams");
    expect(nextEscalation("cpgrams", pune)).toBeNull();
  });
});

// ── SLA timers ────────────────────────────────────────────────────────────

describe("SLA timers", () => {
  it("due date is filed_at + 30 days (CPGRAMS published SLA)", () => {
    expect(CPGRAMS_SLA_DAYS).toBe(30);
    const due = slaDueDate("2026-06-01T00:00:00Z");
    expect(due.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("lapses only after the window", () => {
    expect(isSlaLapsed("2026-06-15T00:00:00Z", NOW)).toBe(false);
    expect(isSlaLapsed("2026-06-09T00:00:00Z", NOW)).toBe(true);
  });
});

// ── Draft generation ──────────────────────────────────────────────────────

const baseCtx: CivicGrievanceContext = {
  issue: {
    issueType: "pothole",
    lat: 18.5204,
    lng: 73.8567,
    roadRef: null,
    reportCount: 3,
    firstReportedAt: "2026-06-20T08:00:00Z",
    lastReportedAt: "2026-07-08T18:00:00Z",
  },
  report: {
    description: "Half a metre deep, right at the bus stop",
    severity: "major",
    verification: "geo_verified",
    accuracyM: 8,
  },
  agency: AGENCIES["ulb-pune"],
};

describe("draftCivicGrievance", () => {
  const draft = draftCivicGrievance(baseCtx);

  it("contains the facts: type, coordinates, crowd count, evidence", () => {
    expect(draft).toContain("Pothole");
    expect(draft).toContain("18.520400, 73.856700");
    expect(draft).toContain("reported 3 times");
    expect(draft).toContain("Pune Municipal Corporation");
    expect(draft).toContain("device-verified (GPS accuracy 8 m)");
    expect(draft).toContain("Half a metre deep");
    expect(draft).toContain("google.com/maps?q=18.520400,73.856700");
  });

  it("states the ULB's statutory maintenance duty", () => {
    expect(draft).toContain("statutory obligation");
  });

  it("adds the safety-hazard paragraph only for safety-critical types", () => {
    expect(draft).not.toContain("public-safety hazard");
    const manhole = draftCivicGrievance({
      ...baseCtx,
      issue: { ...baseCtx.issue, issueType: "open_manhole" },
    });
    expect(manhole).toContain("public-safety hazard");
    expect(manhole).toContain("barricaded");
  });

  it("references the NH and 1033 helpline for highway issues", () => {
    const nh = draftCivicGrievance({
      ...baseCtx,
      issue: { ...baseCtx.issue, roadRef: "NH 48" },
      agency: AGENCIES.nhai,
    });
    expect(nh).toContain("on NH 48");
    expect(nh).toContain("1033");
  });

  it("degrades honestly with no report and unresolved jurisdiction", () => {
    const bare = draftCivicGrievance({
      issue: { ...baseCtx.issue, reportCount: 1 },
      agency: null,
    });
    expect(bare).toContain("the authority responsible for this location");
    expect(bare).toContain("Photographic evidence is available.");
    expect(bare).not.toContain("device-verified");
    expect(bare).not.toContain("statutory obligation");
  });
});

// ── Payload schemas ───────────────────────────────────────────────────────

describe("complaint schemas", () => {
  const uuid = "6f1e1c4a-3b2d-4e5f-8a9b-0c1d2e3f4a5b";

  it("accepts a valid complaint draft payload", () => {
    expect(
      createCivicComplaintSchema.safeParse({
        issueId: uuid,
        channel: "agency_portal",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown channels", () => {
    expect(
      createCivicComplaintSchema.safeParse({
        issueId: uuid,
        channel: "whatsapp",
      }).success,
    ).toBe(false);
  });

  it("validates registration numbers like the fuel tracker", () => {
    expect(
      trackCivicComplaintSchema.safeParse({
        complaintId: uuid,
        referenceNo: "PMOPG/E/2026/0123456",
      }).success,
    ).toBe(true);
    expect(
      trackCivicComplaintSchema.safeParse({
        complaintId: uuid,
        referenceNo: "no!",
      }).success,
    ).toBe(false);
  });
});
