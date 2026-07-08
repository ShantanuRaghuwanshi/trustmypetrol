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
 * Scores are always computed here with the shared engine — packages/shared
 * is the single source of truth for the maths.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && anonKey ? createClient(url, anonKey) : null;

export interface PumpWithScore extends Pump {
  score: PumpScore;
}

interface Dataset {
  pumps: Pump[];
  reports: Report[];
  seeded: boolean;
}

async function loadDataset(): Promise<Dataset> {
  if (supabase) {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [pumpsRes, reportsRes] = await Promise.all([
      supabase.from("pumps").select("*").eq("status", "active"),
      supabase
        .from("reports")
        .select("*")
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(2000),
    ]);
    if (!pumpsRes.error && pumpsRes.data?.length) {
      return {
        pumps: pumpsRes.data.map(mapDbPump),
        reports: (reportsRes.data ?? []).map(mapDbReport),
        seeded: false,
      };
    }
  }
  return { pumps: SEED_PUMPS, reports: SEED_REPORTS, seeded: true };
}

function toScored(dataset: Dataset): PumpWithScore[] {
  return dataset.pumps.map((p) => ({
    ...p,
    score: computePumpScore(
      p.id,
      dataset.reports
        .filter((r) => r.pumpId === p.id)
        .map((r) => ({
          userId: r.userId,
          signals: r.signals,
          verification: r.verification,
          reporterTrustLevel: dataset.seeded
            ? (SEED_TRUST_LEVELS[r.userId] ?? 0)
            : 0,
          reportedAt: r.reportedAt,
        })),
    ),
  }));
}

export async function getPumpsWithScores(): Promise<PumpWithScore[]> {
  return toScored(await loadDataset());
}

export async function getPump(id: string): Promise<PumpWithScore | null> {
  const pumps = await getPumpsWithScores();
  return pumps.find((p) => p.id === id) ?? null;
}

export async function getReports(pumpId: string): Promise<Report[]> {
  const { reports } = await loadDataset();
  return reports
    .filter((r) => r.pumpId === pumpId && r.status === "published")
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
}

/* ---- row mappers (snake_case db → camelCase domain) ---- */

function mapDbPump(row: Record<string, unknown>): Pump {
  return {
    id: String(row.id),
    omc: row.omc as Pump["omc"],
    dealerCode: String(row.dealer_code),
    name: String(row.name),
    address: String(row.address),
    district: String(row.district),
    state: String(row.state),
    lat: Number(row.lat),
    lng: Number(row.lng),
    blends: row.blends as Pump["blends"],
    status: row.status as Pump["status"],
  };
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
