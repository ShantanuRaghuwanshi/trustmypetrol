import { describe, expect, it } from "vitest";
import {
  AGENCIES,
  dlpEndDate,
  dlpStatusOf,
  draftRtiApplication,
  parseBoardText,
  parseInrAmount,
  RTI_FEE_INR,
  RTI_PORTAL_CENTRAL,
  RTI_PORTAL_MAHARASHTRA,
  RTI_RESPONSE_DAYS,
  rtiDueDate,
  rtiPortalFor,
} from "../src";

const NOW = new Date("2026-07-10T12:00:00Z");

// ── DLP engine ────────────────────────────────────────────────────────────

describe("DLP engine", () => {
  const work = { completionDate: "2024-01-15", dlpMonths: 36 };

  it("computes the DLP end date from completion + months", () => {
    expect(dlpEndDate(work)?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("classifies inside / expired / unknown", () => {
    expect(dlpStatusOf(work, NOW)).toBe("inside"); // ends Jan 2027
    expect(
      dlpStatusOf({ completionDate: "2020-01-15", dlpMonths: 36 }, NOW),
    ).toBe("expired");
    expect(dlpStatusOf({ completionDate: null, dlpMonths: 36 }, NOW)).toBe(
      "unknown",
    );
    expect(
      dlpStatusOf({ completionDate: "2024-01-15", dlpMonths: null }, NOW),
    ).toBe("unknown");
  });
});

// ── Board parser ──────────────────────────────────────────────────────────

describe("parseInrAmount", () => {
  it("handles crore / lakh / plain rupee formats", () => {
    expect(parseInrAmount("₹ 4.5 Crore")).toBe(45_000_000);
    expect(parseInrAmount("Rs. 25 lakh")).toBe(2_500_000);
    expect(parseInrAmount("Rs 12,50,000")).toBe(1_250_000);
    expect(parseInrAmount("garbage")).toBeNull();
  });
});

describe("parseBoardText", () => {
  const board = `
    PUNE MUNICIPAL CORPORATION
    Name of Work : Improvement of Baner Road Ch. 0/00 to 2/500
    Estimated Cost : Rs. 4.25 Crore
    Work Order No : PMC/RD/2024/0713
    Date of Commencement : 15/02/2024
    Date of Completion : 14/02/2025
    Defect Liability Period : 3 Years
    Name of Contractor : M/s Example Infra Pvt Ltd
  `;

  it("extracts the accountability fields", () => {
    const p = parseBoardText(board);
    expect(p.contractorName).toBe("M/s Example Infra Pvt Ltd");
    expect(p.costInr).toBe(42_500_000);
    expect(p.workOrderNo).toBe("PMC/RD/2024/0713");
    expect(p.startDate).toBe("2024-02-15");
    expect(p.completionDate).toBe("2025-02-14");
    expect(p.dlpMonths).toBe(36);
  });

  it("prefills, never invents: unmatched fields stay null", () => {
    const p = parseBoardText("completely unrelated text");
    expect(p).toEqual({
      contractorName: null,
      costInr: null,
      workOrderNo: null,
      startDate: null,
      completionDate: null,
      dlpMonths: null,
    });
  });

  it("normalises DLP given in months", () => {
    expect(parseBoardText("DLP : 24 months").dlpMonths).toBe(24);
  });
});

// ── RTI assistant ─────────────────────────────────────────────────────────

describe("rtiPortalFor", () => {
  it("routes central agencies to rtionline.gov.in", () => {
    expect(rtiPortalFor(AGENCIES.nhai)).toEqual(RTI_PORTAL_CENTRAL);
    expect(rtiPortalFor(AGENCIES.pmgsy)).toEqual(RTI_PORTAL_CENTRAL);
  });

  it("routes Maharashtra bodies to the state portal, others to null", () => {
    expect(rtiPortalFor(AGENCIES["ulb-pune"])).toEqual(
      RTI_PORTAL_MAHARASHTRA,
    );
    expect(rtiPortalFor(AGENCIES["ulb-bengaluru"])).toBeNull(); // no invented portals
    expect(rtiPortalFor(null)).toBeNull();
  });
});

describe("rtiDueDate", () => {
  it("applies the statutory 30-day window", () => {
    expect(RTI_RESPONSE_DAYS).toBe(30);
    expect(rtiDueDate("2026-06-01T00:00:00Z").toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });
});

describe("draftRtiApplication", () => {
  const issue = {
    issueType: "pothole" as const,
    lat: 18.5204,
    lng: 73.8567,
    roadRef: null,
  };

  it("cites the Act, the fee, and the accountability record set", () => {
    const d = draftRtiApplication({ issue, agency: AGENCIES["ulb-pune"] });
    expect(d).toContain("Section 6(1) of the Right to Information Act, 2005");
    expect(d).toContain("Pune Municipal Corporation");
    expect(d).toContain("work order and contract agreement");
    expect(d).toContain("defect liability");
    expect(d).toContain("quality-control and third-party audit");
    expect(d).toContain(`₹${RTI_FEE_INR}`);
    expect(d).toContain("Section 6(3)"); // transfer clause
    expect(d).toContain("18.520400, 73.856700");
  });

  it("narrows to a known work order and flags a live DLP", () => {
    const d = draftRtiApplication({
      issue,
      agency: AGENCIES["ulb-pune"],
      work: {
        title: "Baner Road improvement",
        workOrderNo: "PMC/RD/2024/0713",
        contractorName: "M/s Example Infra Pvt Ltd",
        completionDate: "2025-02-14",
        dlpMonths: 36,
      },
      now: NOW,
    });
    expect(d).toContain("PMC/RD/2024/0713");
    expect(d).toContain("defect liability period for this work has not yet expired");
  });

  it("degrades honestly with no agency", () => {
    const d = draftRtiApplication({ issue, agency: null });
    expect(d).toContain("The public authority responsible");
  });
});
