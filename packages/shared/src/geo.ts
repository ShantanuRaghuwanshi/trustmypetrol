import type { Verification } from "./types";

export const GEO_VERIFY_MAX_DISTANCE_M = 150;
export const GEO_VERIFY_MAX_UPLOAD_GAP_MIN = 10;

/** Haversine distance in metres. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface CaptureEvidence {
  lat: number;
  lng: number;
  capturedAt: string | Date;
  receivedAt: string | Date;
  mockLocation: boolean;
}

/**
 * Classify a capture against a pump location. Failing verification never
 * blocks the report — it publishes as unverified with lower score weight.
 */
export function classifyCapture(
  capture: CaptureEvidence,
  pumpLat: number,
  pumpLng: number,
): { verification: Verification; distanceM: number } {
  const distanceM = distanceMeters(capture.lat, capture.lng, pumpLat, pumpLng);
  const gapMin =
    (new Date(capture.receivedAt).getTime() -
      new Date(capture.capturedAt).getTime()) /
    60_000;

  if (capture.mockLocation || gapMin < 0 || gapMin > GEO_VERIFY_MAX_UPLOAD_GAP_MIN) {
    return { verification: "unverified", distanceM };
  }
  if (distanceM > GEO_VERIFY_MAX_DISTANCE_M) {
    return { verification: "location_mismatch", distanceM };
  }
  return { verification: "geo_verified", distanceM };
}
