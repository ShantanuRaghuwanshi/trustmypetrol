import { isNegativeReport, isScorableReport, type Signal } from "./signals";
import type { PumpScore, ScoreVerdict, Verification } from "./types";

/**
 * Trust-score maths, per docs/MVP-ARCHITECTURE.md:
 *
 *   trust_score = 100 × (1 − weighted_negative_ratio)
 *   weight(report) = 1.0
 *     × 1.5   if geo_verified
 *     × 1.25  if reporter trust_level ≥ 1
 *     × 2^(−age_days / 30)          recency decay, half-life 30 days
 *   dampening: max 1 counted report per user per pump per 7 days
 *   pumps with < MIN_WEIGHTED_REPORTS weighted volume → score null
 *
 * Kept as a pure function so the same maths can back the SQL view, be unit
 * tested, and render previews client-side.
 */

export const SCORE_WINDOW_DAYS = 90;
export const RECENCY_HALF_LIFE_DAYS = 30;
export const MIN_WEIGHTED_REPORTS = 5;
export const DAMPENING_WINDOW_DAYS = 7;
export const GEO_VERIFIED_WEIGHT = 1.5;
export const TRUSTED_REPORTER_WEIGHT = 1.25;

export interface ScorableReport {
  userId: string;
  signals: Signal[];
  verification: Verification;
  reporterTrustLevel: number;
  reportedAt: string | Date;
}

export function scoreVerdict(score: number): ScoreVerdict {
  if (score >= 80) return "good";
  if (score >= 50) return "mixed";
  return "poor";
}

export function reportWeight(
  report: ScorableReport,
  now: Date = new Date(),
): number {
  const ageDays =
    (now.getTime() - new Date(report.reportedAt).getTime()) / 86_400_000;
  if (ageDays < 0 || ageDays > SCORE_WINDOW_DAYS) return 0;
  let weight = 1.0;
  if (report.verification === "geo_verified") weight *= GEO_VERIFIED_WEIGHT;
  if (report.reporterTrustLevel >= 1) weight *= TRUSTED_REPORTER_WEIGHT;
  weight *= 2 ** (-ageDays / RECENCY_HALF_LIFE_DAYS);
  return weight;
}

/**
 * Anti-brigading: per user, keep only the most recent report in any rolling
 * 7-day window (per pump — callers pass one pump's reports).
 */
export function dampen(reports: ScorableReport[]): ScorableReport[] {
  const byUser = new Map<string, ScorableReport[]>();
  for (const r of reports) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }
  const kept: ScorableReport[] = [];
  for (const list of byUser.values()) {
    list.sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
    let lastKeptAt: number | null = null;
    for (const r of list) {
      const t = new Date(r.reportedAt).getTime();
      if (
        lastKeptAt === null ||
        lastKeptAt - t >= DAMPENING_WINDOW_DAYS * 86_400_000
      ) {
        kept.push(r);
        lastKeptAt = t;
      }
    }
  }
  return kept;
}

export function computePumpScore(
  pumpId: string,
  reports: ScorableReport[],
  now: Date = new Date(),
): PumpScore {
  const scorable = reports.filter((r) => isScorableReport(r.signals));
  const counted = dampen(scorable);

  let weightedTotal = 0;
  let weightedNegative = 0;
  let geoVerified = 0;
  const signalCounts: Partial<Record<Signal, number>> = {};

  for (const r of counted) {
    const w = reportWeight(r, now);
    if (w === 0) continue;
    weightedTotal += w;
    if (isNegativeReport(r.signals)) weightedNegative += w;
    if (r.verification === "geo_verified") geoVerified++;
    for (const s of r.signals) {
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }

  const enough = weightedTotal >= MIN_WEIGHTED_REPORTS;
  const score = enough
    ? Math.round(100 * (1 - weightedNegative / weightedTotal))
    : null;

  return {
    pumpId,
    score,
    verdict: score === null ? null : scoreVerdict(score),
    reportCount: reports.length,
    countedReports: counted.length,
    geoVerifiedRatio:
      counted.length === 0 ? 0 : geoVerified / counted.length,
    signalCounts,
  };
}
