import { describe, expect, it } from "vitest";
import {
  AGENCIES,
  ALL_AGENCY_SLUGS,
  ALL_ISSUE_TYPES,
  CIVIC_GEO_MAX_ACCURACY_M,
  CPGRAMS_PORTAL,
  ISSUE_CATEGORIES,
  ISSUE_TYPES,
  NH_BUFFER_M,
  SAFETY_CRITICAL_ISSUE_TYPES,
  STATE_PWD_FALLBACK_M,
  classifyCivicCapture,
  classifyJurisdiction,
  clusterRadiusM,
  createCivicReportSchema,
  isAgencySlug,
  shouldAttachToIssue,
  statePwdFor,
  type JurisdictionHits,
} from "../src";
import { CITIES } from "@tmp/shared";

// ── Vocabulary invariants ─────────────────────────────────────────────────

describe("issue vocabulary", () => {
  it("every type has a label, hint, known category, and positive radius", () => {
    for (const t of ALL_ISSUE_TYPES) {
      const def = ISSUE_TYPES[t];
      expect(def.label.length, t).toBeGreaterThan(0);
      expect(def.hint.length, t).toBeGreaterThan(0);
      expect(ISSUE_CATEGORIES[def.category], t).toBeDefined();
      expect(def.clusterRadiusM, t).toBeGreaterThan(0);
      expect(def.clusterRadiusM, t).toBeLessThanOrEqual(500);
    }
  });

  it("flags open manholes and exposed wiring as safety-critical", () => {
    expect(SAFETY_CRITICAL_ISSUE_TYPES).toContain("open_manhole");
    expect(SAFETY_CRITICAL_ISSUE_TYPES).toContain("exposed_wiring");
  });

  it("clusters within the per-type radius and not beyond it", () => {
    expect(clusterRadiusM("pothole")).toBe(25);
    expect(shouldAttachToIssue("pothole", 25)).toBe(true);
    expect(shouldAttachToIssue("pothole", 25.1)).toBe(false);
    // waterlogging covers a stretch — wider radius than a point defect
    expect(clusterRadiusM("waterlogging")).toBeGreaterThan(
      clusterRadiusM("pothole"),
    );
  });
});

// ── Agency registry invariants ────────────────────────────────────────────

describe("agency registry", () => {
  it("covers every pilot city with a ULB and its state with a PWD", () => {
    for (const city of CITIES) {
      const ulb = ALL_AGENCY_SLUGS.map((s) => AGENCIES[s]).find(
        (a) => a.kind === "ulb" && a.city === city.name,
      );
      expect(ulb, city.name).toBeDefined();
      expect(statePwdFor(city.state), city.state).not.toBeNull();
    }
  });

  it("slugs are self-consistent and portal URLs are https-or-null", () => {
    for (const slug of ALL_AGENCY_SLUGS) {
      const a = AGENCIES[slug];
      expect(a.slug).toBe(slug);
      expect(isAgencySlug(slug)).toBe(true);
      for (const p of [a.portal, a.escalation]) {
        if (p?.url) expect(p.url, slug).toMatch(/^https?:\/\//);
      }
    }
    expect(isAgencySlug("not-an-agency")).toBe(false);
  });

  it("CPGRAMS backstop is pinned to the official portal", () => {
    expect(CPGRAMS_PORTAL.url).toBe("https://pgportal.gov.in/");
  });
});

// ── Jurisdiction precedence ───────────────────────────────────────────────

const noHits: JurisdictionHits = { nhRef: null, ulbSlug: null, nearestUlb: null };

describe("classifyJurisdiction", () => {
  it("NH proximity wins over ULB containment", () => {
    const r = classifyJurisdiction({
      nhRef: "NH 48",
      ulbSlug: "ulb-pune",
      nearestUlb: null,
    });
    expect(r).toEqual({ kind: "nhai", agencySlug: "nhai", roadRef: "NH 48" });
  });

  it("routes to the containing ULB when off the highway", () => {
    const r = classifyJurisdiction({ ...noHits, ulbSlug: "ulb-pune" });
    expect(r).toEqual({ kind: "ulb", agencySlug: "ulb-pune", roadRef: null });
  });

  it("falls back to the state PWD inside the peri-urban band", () => {
    const r = classifyJurisdiction({
      ...noHits,
      nearestUlb: { slug: "ulb-pune", distanceM: 12_000 },
    });
    expect(r.kind).toBe("state_pwd");
    expect(r.agencySlug).toBe("pwd-maharashtra");
  });

  it("is unresolved beyond the fallback band — never guesses", () => {
    const r = classifyJurisdiction({
      ...noHits,
      nearestUlb: { slug: "ulb-pune", distanceM: STATE_PWD_FALLBACK_M + 1 },
    });
    expect(r).toEqual({ kind: "unresolved", agencySlug: null, roadRef: null });
  });

  it("is unresolved with no spatial hits at all", () => {
    expect(classifyJurisdiction(noHits).kind).toBe("unresolved");
  });

  it("shares its buffer constants with the SQL mirror", () => {
    // If these change, update resolve_jurisdiction() in 0007_civic_infra.sql.
    expect(NH_BUFFER_M).toBe(60);
    expect(STATE_PWD_FALLBACK_M).toBe(25_000);
  });
});

// ── Capture verification ──────────────────────────────────────────────────

const NOW = new Date("2026-07-10T12:00:00Z");
const minsBefore = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("classifyCivicCapture", () => {
  const fresh = {
    accuracyM: 12,
    capturedAt: minsBefore(1),
    receivedAt: NOW,
    mockLocation: false,
  };

  it("geo-verifies an accurate, fresh, non-mocked capture", () => {
    expect(classifyCivicCapture(fresh)).toBe("geo_verified");
  });

  it("rejects mock locations and stale uploads as unverified", () => {
    expect(classifyCivicCapture({ ...fresh, mockLocation: true })).toBe(
      "unverified",
    );
    expect(
      classifyCivicCapture({ ...fresh, capturedAt: minsBefore(11) }),
    ).toBe("unverified");
    // clock skew: capture "after" receipt
    expect(
      classifyCivicCapture({ ...fresh, capturedAt: minsBefore(-1) }),
    ).toBe("unverified");
  });

  it("marks coarse GPS fixes as location_mismatch, not rejected", () => {
    expect(
      classifyCivicCapture({
        ...fresh,
        accuracyM: CIVIC_GEO_MAX_ACCURACY_M + 1,
      }),
    ).toBe("location_mismatch");
  });
});

// ── Payload schema ────────────────────────────────────────────────────────

describe("createCivicReportSchema", () => {
  const valid = {
    issueType: "pothole",
    description: "Deep pothole near the bus stop",
    severity: "major",
    capture: {
      lat: 18.5204,
      lng: 73.8567,
      accuracyM: 8,
      capturedAt: "2026-07-10T11:59:00Z",
      mockLocation: false,
    },
  };

  it("accepts a valid payload and defaults kind to 'report'", () => {
    const parsed = createCivicReportSchema.parse(valid);
    expect(parsed.kind).toBe("report");
    expect(parsed.issueType).toBe("pothole");
  });

  it("requires a capture — the location is the subject", () => {
    const { capture: _, ...withoutCapture } = valid;
    expect(createCivicReportSchema.safeParse(withoutCapture).success).toBe(
      false,
    );
  });

  it("rejects unknown issue types and out-of-range coordinates", () => {
    expect(
      createCivicReportSchema.safeParse({ ...valid, issueType: "ufo_landing" })
        .success,
    ).toBe(false);
    expect(
      createCivicReportSchema.safeParse({
        ...valid,
        capture: { ...valid.capture, lat: 91 },
      }).success,
    ).toBe(false);
  });

  it("caps descriptions at 500 characters", () => {
    expect(
      createCivicReportSchema.safeParse({
        ...valid,
        description: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
