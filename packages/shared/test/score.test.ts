import { describe, expect, it } from "vitest";
import {
  computePumpScore,
  dampen,
  reportWeight,
  scoreVerdict,
  type ScorableReport,
} from "../src/score";
import { classifyCapture, distanceMeters } from "../src/geo";
import { draftGrievance } from "../src/complaint";
import { SEED_PUMPS, SEED_REPORTS, SEED_TRUST_LEVELS } from "../src/seed";

const NOW = new Date("2026-07-08T12:00:00Z");

function report(overrides: Partial<ScorableReport> = {}): ScorableReport {
  return {
    userId: "u1",
    signals: ["mileage_drop"],
    verification: "unverified",
    reporterTrustLevel: 0,
    reportedAt: NOW.toISOString(),
    ...overrides,
  };
}

const daysBefore = (d: number) =>
  new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("reportWeight", () => {
  it("weights a fresh unverified report at 1.0", () => {
    expect(reportWeight(report(), NOW)).toBeCloseTo(1.0);
  });

  it("multiplies geo-verified and trusted-reporter weights", () => {
    const w = reportWeight(
      report({ verification: "geo_verified", reporterTrustLevel: 1 }),
      NOW,
    );
    expect(w).toBeCloseTo(1.5 * 1.25);
  });

  it("halves weight after the 30-day half-life", () => {
    const w = reportWeight(report({ reportedAt: daysBefore(30) }), NOW);
    expect(w).toBeCloseTo(0.5);
  });

  it("zeroes reports outside the 90-day window or from the future", () => {
    expect(reportWeight(report({ reportedAt: daysBefore(91) }), NOW)).toBe(0);
    expect(reportWeight(report({ reportedAt: daysBefore(-1) }), NOW)).toBe(0);
  });
});

describe("dampen (anti-brigading)", () => {
  it("keeps one report per user per 7-day window", () => {
    const spam = [0, 1, 2, 3, 8].map((d) =>
      report({ reportedAt: daysBefore(d) }),
    );
    const kept = dampen(spam);
    // day 0 kept, days 1–3 dropped (within 7d of day 0), day 8 kept
    expect(kept).toHaveLength(2);
  });

  it("does not dampen across different users", () => {
    const same_day = ["a", "b", "c"].map((u) => report({ userId: u }));
    expect(dampen(same_day)).toHaveLength(3);
  });
});

describe("computePumpScore", () => {
  it("returns null score below minimum weighted volume", () => {
    const s = computePumpScore("p1", [report()], NOW);
    expect(s.score).toBeNull();
    expect(s.verdict).toBeNull();
  });

  it("scores 100 for all-positive history", () => {
    const reports = Array.from({ length: 8 }, (_, i) =>
      report({
        userId: `u${i}`,
        signals: ["good_experience"],
        verification: "geo_verified",
        reportedAt: daysBefore(i),
      }),
    );
    const s = computePumpScore("p1", reports, NOW);
    expect(s.score).toBe(100);
    expect(s.verdict).toBe("good");
  });

  it("scores 0 for all-negative history", () => {
    const reports = Array.from({ length: 8 }, (_, i) =>
      report({
        userId: `u${i}`,
        verification: "geo_verified",
        reportedAt: daysBefore(i),
      }),
    );
    const s = computePumpScore("p1", reports, NOW);
    expect(s.score).toBe(0);
    expect(s.verdict).toBe("poor");
  });

  it("excludes neutral blend_update reports from scoring", () => {
    const reports = Array.from({ length: 10 }, (_, i) =>
      report({
        userId: `u${i}`,
        signals: ["blend_update"],
        verification: "geo_verified",
        reportedAt: daysBefore(i),
      }),
    );
    const s = computePumpScore("p1", reports, NOW);
    expect(s.countedReports).toBe(0);
    expect(s.score).toBeNull();
  });

  it("weighs geo-verified negatives more than unverified positives", () => {
    const reports = [
      ...Array.from({ length: 4 }, (_, i) =>
        report({
          userId: `neg${i}`,
          verification: "geo_verified",
          reportedAt: daysBefore(i),
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        report({
          userId: `pos${i}`,
          signals: ["good_experience"],
          reportedAt: daysBefore(i),
        }),
      ),
    ];
    const s = computePumpScore("p1", reports, NOW);
    expect(s.score).not.toBeNull();
    expect(s.score!).toBeLessThan(50); // 1.5-weighted negatives dominate
  });
});

describe("scoreVerdict bands", () => {
  it("maps 80/50 boundaries", () => {
    expect(scoreVerdict(80)).toBe("good");
    expect(scoreVerdict(79)).toBe("mixed");
    expect(scoreVerdict(50)).toBe("mixed");
    expect(scoreVerdict(49)).toBe("poor");
  });
});

describe("geo verification", () => {
  const pump = { lat: 18.559, lng: 73.7868 };

  it("computes plausible distances", () => {
    // ~1 degree latitude ≈ 111 km
    expect(distanceMeters(18.0, 73.0, 19.0, 73.0)).toBeGreaterThan(110_000);
    expect(distanceMeters(18.0, 73.0, 19.0, 73.0)).toBeLessThan(112_000);
  });

  it("verifies a close, prompt, non-mocked capture", () => {
    const r = classifyCapture(
      {
        lat: 18.5592,
        lng: 73.787,
        capturedAt: NOW.toISOString(),
        receivedAt: new Date(NOW.getTime() + 60_000).toISOString(),
        mockLocation: false,
      },
      pump.lat,
      pump.lng,
    );
    expect(r.verification).toBe("geo_verified");
    expect(r.distanceM).toBeLessThan(150);
  });

  it("flags distant captures as location_mismatch", () => {
    const r = classifyCapture(
      {
        lat: 18.57,
        lng: 73.787,
        capturedAt: NOW.toISOString(),
        receivedAt: NOW.toISOString(),
        mockLocation: false,
      },
      pump.lat,
      pump.lng,
    );
    expect(r.verification).toBe("location_mismatch");
  });

  it("rejects mock locations and stale uploads", () => {
    const base = {
      lat: pump.lat,
      lng: pump.lng,
      capturedAt: NOW.toISOString(),
    };
    expect(
      classifyCapture(
        { ...base, receivedAt: NOW.toISOString(), mockLocation: true },
        pump.lat,
        pump.lng,
      ).verification,
    ).toBe("unverified");
    expect(
      classifyCapture(
        {
          ...base,
          receivedAt: new Date(NOW.getTime() + 11 * 60_000).toISOString(),
          mockLocation: false,
        },
        pump.lat,
        pump.lng,
      ).verification,
    ).toBe("unverified");
  });
});

describe("seed data sanity", () => {
  it("produces the demo score spread (good / mixed / poor / no-data)", () => {
    const verdicts = SEED_PUMPS.map((p) => {
      const reports = SEED_REPORTS.filter((r) => r.pumpId === p.id).map(
        (r) => ({
          userId: r.userId,
          signals: r.signals,
          verification: r.verification,
          reporterTrustLevel: SEED_TRUST_LEVELS[r.userId] ?? 0,
          reportedAt: r.reportedAt,
        }),
      );
      return computePumpScore(p.id, reports).verdict;
    });
    expect(verdicts).toContain("good");
    expect(verdicts).toContain("mixed");
    expect(verdicts).toContain("poor");
    expect(verdicts).toContain(null); // "not enough data" pumps
  });
});

describe("draftGrievance", () => {
  it("includes dealer code, purchase details, and geo evidence line", () => {
    const pump = SEED_PUMPS[0]!;
    const rep = SEED_REPORTS[0]!;
    const text = draftGrievance(pump, rep);
    expect(text).toContain(pump.dealerCode);
    expect(text).toContain("4.96 L");
    expect(text).toContain("verified within");
    expect(text).not.toContain("adulterat"); // drafts stay accusation-free
  });
});
