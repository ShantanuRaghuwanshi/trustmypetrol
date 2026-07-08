import { createClient } from "@supabase/supabase-js";
import {
  computePumpScore,
  type Pump,
  type PumpScore,
  type Report,
} from "@tmp/shared";
import { SEED_PUMPS, SEED_REPORTS, SEED_TRUST_LEVELS } from "@tmp/shared/seed";

/**
 * Data access with a bundled-seed fallback: when Supabase env vars are absent
 * (local dev, demos), the site runs entirely off packages/shared seed data.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && anonKey ? createClient(url, anonKey) : null;

export interface PumpWithScore extends Pump {
  score: PumpScore;
}

function toScoreInput(r: Report) {
  return {
    userId: r.userId,
    signals: r.signals,
    verification: r.verification,
    reporterTrustLevel: SEED_TRUST_LEVELS[r.userId] ?? 0,
    reportedAt: r.reportedAt,
  };
}

export async function getPumpsWithScores(): Promise<PumpWithScore[]> {
  if (supabase) {
    const [{ data: pumps, error }, { data: scores }] = await Promise.all([
      supabase.rpc("pumps_near", {
        in_lat: 18.5204,
        in_lng: 73.8567,
        in_radius_m: 30_000,
      }),
      supabase.from("pump_scores").select("*"),
    ]);
    if (!error && pumps?.length) {
      return pumps.map((p: Record<string, unknown>) => mapDbPump(p, scores ?? []));
    }
  }
  return SEED_PUMPS.map((p) => ({
    ...p,
    score: computePumpScore(
      p.id,
      SEED_REPORTS.filter((r) => r.pumpId === p.id).map(toScoreInput),
    ),
  }));
}

export async function getPump(id: string): Promise<PumpWithScore | null> {
  const pumps = await getPumpsWithScores();
  return pumps.find((p) => p.id === id) ?? null;
}

export async function getReports(pumpId: string): Promise<Report[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("pump_id", pumpId)
      .eq("status", "published")
      .order("reported_at", { ascending: false })
      .limit(20);
    if (!error && data) return data.map(mapDbReport);
  }
  return SEED_REPORTS.filter((r) => r.pumpId === pumpId).sort(
    (a, b) =>
      new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
  );
}

/* ---- row mappers (snake_case db → camelCase domain) ---- */

function mapDbPump(
  row: Record<string, unknown>,
  scores: Record<string, unknown>[],
): PumpWithScore {
  const s = scores.find((x) => x.pump_id === row.id);
  // pumps_near returns geography; Supabase serialises point as GeoJSON via
  // st_asgeojson in a view in production — seed coordinates cover the demo.
  const coords = parseLocation(row.location);
  return {
    id: String(row.id),
    omc: row.omc as Pump["omc"],
    dealerCode: String(row.dealer_code),
    name: String(row.name),
    address: String(row.address),
    district: String(row.district),
    state: String(row.state),
    lat: coords?.lat ?? 0,
    lng: coords?.lng ?? 0,
    blends: row.blends as Pump["blends"],
    status: row.status as Pump["status"],
    score: {
      pumpId: String(row.id),
      score: (s?.score as number | null) ?? null,
      verdict:
        s?.score == null
          ? null
          : (s.score as number) >= 80
            ? "good"
            : (s.score as number) >= 50
              ? "mixed"
              : "poor",
      reportCount: (s?.report_count_90d as number) ?? 0,
      countedReports: (s?.counted_reports as number) ?? 0,
      geoVerifiedRatio: Number(s?.geo_verified_ratio ?? 0),
      signalCounts: (s?.signal_counts as PumpScore["signalCounts"]) ?? {},
    },
  };
}

function parseLocation(loc: unknown): { lat: number; lng: number } | null {
  if (
    typeof loc === "object" &&
    loc !== null &&
    "coordinates" in loc &&
    Array.isArray((loc as { coordinates: unknown }).coordinates)
  ) {
    const [lng, lat] = (loc as { coordinates: number[] }).coordinates;
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
}

function mapDbReport(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    pumpId: String(row.pump_id),
    signals: row.signals as Report["signals"],
    freeText: (row.free_text as string) ?? undefined,
    odoKm: (row.odo_km as number) ?? undefined,
    litres: row.litres == null ? undefined : Number(row.litres),
    amountInr: row.amount_inr == null ? undefined : Number(row.amount_inr),
    verification: row.verification as Report["verification"],
    distanceToPumpM:
      row.distance_to_pump_m == null
        ? undefined
        : Number(row.distance_to_pump_m),
    reportedAt: String(row.reported_at),
    status: row.status as Report["status"],
  };
}
