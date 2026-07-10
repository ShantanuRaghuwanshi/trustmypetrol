/**
 * Jurisdiction resolution: given where a report was captured, decide which
 * agency owns the asset. The spatial queries (NH proximity, ULB polygon
 * containment, nearest-ULB) run in PostGIS — resolve_jurisdiction() in
 * supabase/migrations/0007_civic_infra.sql. This module holds the pure
 * precedence logic and the constants both sides share, so the rules are
 * unit-testable without a database. Keep the SQL mirror in sync.
 *
 * Precedence (first match wins):
 *   1. Within NH_BUFFER_M of a National Highway centreline → NHAI.
 *   2. Inside a ULB municipal boundary                      → that ULB.
 *   3. Within STATE_PWD_FALLBACK_M of a ULB boundary        → that state's PWD
 *      (peri-urban roads around a pilot metro are typically state PWD assets).
 *   4. Otherwise → unresolved; the report is still accepted and the user is
 *      pointed at CPGRAMS, which routes internally.
 *
 * PMGSY (rural) detection needs OMMAS road geometry and is deliberately
 * deferred — this pilot is metro-focused and we never guess an agency.
 */
import {
  GEO_VERIFY_MAX_UPLOAD_GAP_MIN,
  type Verification,
} from "@tmp/shared";
import { AGENCIES, statePwdFor, type AgencyKind, type AgencySlug } from "./agencies";

/** How close to an NH centreline (metres) counts as "on the highway". */
export const NH_BUFFER_M = 60;

/** Peri-urban band around ULB limits attributed to the state PWD. */
export const STATE_PWD_FALLBACK_M = 25_000;

/** GPS fixes coarser than this cannot geo-verify a civic report. */
export const CIVIC_GEO_MAX_ACCURACY_M = 100;

/** Spatial-query results fed into the precedence rules. */
export interface JurisdictionHits {
  /** NH ref (e.g. "NH 48") when within NH_BUFFER_M of a highway, else null. */
  nhRef: string | null;
  /** ULB agency slug whose boundary contains the point, else null. */
  ulbSlug: AgencySlug | null;
  /** Nearest ULB boundary when not inside one, with distance to it. */
  nearestUlb: { slug: AgencySlug; distanceM: number } | null;
}

export interface ResolvedJurisdiction {
  kind: AgencyKind | "unresolved";
  agencySlug: AgencySlug | null;
  /** Road identifier when the match came from road geometry (NH ref). */
  roadRef: string | null;
}

/** Pure precedence over pre-computed spatial hits. Mirrored in SQL. */
export function classifyJurisdiction(
  hits: JurisdictionHits,
): ResolvedJurisdiction {
  if (hits.nhRef) {
    return { kind: "nhai", agencySlug: "nhai", roadRef: hits.nhRef };
  }
  if (hits.ulbSlug) {
    return { kind: "ulb", agencySlug: hits.ulbSlug, roadRef: null };
  }
  if (hits.nearestUlb && hits.nearestUlb.distanceM <= STATE_PWD_FALLBACK_M) {
    const pwd = statePwdFor(AGENCIES[hits.nearestUlb.slug].state);
    if (pwd) {
      return {
        kind: "state_pwd",
        agencySlug: pwd.slug as AgencySlug,
        roadRef: null,
      };
    }
  }
  return { kind: "unresolved", agencySlug: null, roadRef: null };
}

/**
 * Capture verification for civic reports. Unlike pump reports there is no
 * reference entity to measure distance against — the capture location *is*
 * the subject — so verification rests on the device's own evidence:
 * mock-location flag, capture-to-upload gap, and GPS accuracy. Mirrored by
 * classify_civic_capture() in SQL. Failing verification never blocks the
 * report; it publishes as unverified with lower weight, same as fuel reports.
 */
export interface CivicCaptureEvidence {
  accuracyM: number;
  capturedAt: string | Date;
  receivedAt: string | Date;
  mockLocation: boolean;
}

export function classifyCivicCapture(c: CivicCaptureEvidence): Verification {
  const gapMin =
    (new Date(c.receivedAt).getTime() - new Date(c.capturedAt).getTime()) /
    60_000;
  if (c.mockLocation || gapMin < 0 || gapMin > GEO_VERIFY_MAX_UPLOAD_GAP_MIN) {
    return "unverified";
  }
  if (c.accuracyM > CIVIC_GEO_MAX_ACCURACY_M) {
    return "location_mismatch";
  }
  return "geo_verified";
}
