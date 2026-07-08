import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import {
  computePumpScore,
  type Pump,
  type PumpScore,
  type Report,
  type Signal,
  type Verification,
} from "@tmp/shared";
import { SEED_PUMPS, SEED_REPORTS, SEED_TRUST_LEVELS } from "@tmp/shared/seed";
import { supabase } from "@/lib/supabase";

/**
 * Data store. With Supabase env configured it runs live (auth, real
 * queries, server-classified report submission); otherwise it falls back
 * to the bundled Pune seed so the app still demos offline.
 */

export interface LocalReportInput {
  pumpId: string;
  signals: Signal[];
  freeText?: string;
  litres?: number;
  amountInr?: number;
  odoKm?: number;
  photoUri?: string;
  capture?: {
    lat: number;
    lng: number;
    capturedAt: string;
    mockLocation: boolean;
  };
  /** seed-mode only: classification done on device */
  verification: Verification;
  distanceToPumpM?: number;
}

export interface SubmitResult {
  verification: Verification;
  distanceM?: number;
}

interface Store {
  isLive: boolean;
  session: Session | null;
  pumps: Pump[];
  loading: boolean;
  reportsFor: (pumpId: string) => Report[];
  scoreFor: (pumpId: string) => PumpScore;
  myReports: Report[];
  addReport: (input: LocalReportInput) => Promise<SubmitResult>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);
const LOCAL_USER = "me";

function mapDbReport(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    pumpId: String(row.pump_id),
    signals: row.signals as Signal[],
    freeText: (row.free_text as string) ?? undefined,
    litres: row.litres == null ? undefined : Number(row.litres),
    amountInr: row.amount_inr == null ? undefined : Number(row.amount_inr),
    odoKm: (row.odo_km as number) ?? undefined,
    verification: row.verification as Report["verification"],
    distanceToPumpM:
      row.distance_to_pump_m == null
        ? undefined
        : Number(row.distance_to_pump_m),
    reportedAt: String(row.reported_at),
    status: row.status as Report["status"],
  };
}

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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const isLive = supabase !== null;
  const [session, setSession] = useState<Session | null>(null);
  const [pumps, setPumps] = useState<Pump[]>(isLive ? [] : SEED_PUMPS);
  const [reports, setReports] = useState<Report[]>(isLive ? [] : SEED_REPORTS);
  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(isLive);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [pumpsRes, reportsRes] = await Promise.all([
      supabase.from("pumps").select("*").eq("status", "active"),
      supabase
        .from("reports")
        .select("*")
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(1000),
    ]);
    if (pumpsRes.data) setPumps(pumpsRes.data.map(mapDbPump));
    if (reportsRes.data) setReports(reportsRes.data.map(mapDbReport));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLive) void refresh();
  }, [isLive, refresh]);

  const value = useMemo<Store>(() => {
    const all = isLive ? reports : [...localReports, ...SEED_REPORTS];
    const uid = session?.user.id;
    return {
      isLive,
      session,
      pumps,
      loading,
      reportsFor: (pumpId) => all.filter((r) => r.pumpId === pumpId),
      scoreFor: (pumpId) =>
        computePumpScore(
          pumpId,
          all
            .filter((r) => r.pumpId === pumpId)
            .map((r) => ({
              userId: r.userId,
              signals: r.signals,
              verification: r.verification,
              reporterTrustLevel: isLive
                ? 0
                : (SEED_TRUST_LEVELS[r.userId] ?? 0),
              reportedAt: r.reportedAt,
            })),
        ),
      myReports: isLive
        ? reports.filter((r) => uid && r.userId === uid)
        : localReports,
      refresh,
      addReport: async (input) => {
        if (supabase) {
          const { data, error } = await supabase.rpc("submit_report", {
            in_pump_id: input.pumpId,
            in_signals: input.signals,
            in_free_text: input.freeText ?? null,
            in_litres: input.litres ?? null,
            in_amount_inr: input.amountInr ?? null,
            in_odo_km: input.odoKm ?? null,
            in_lat: input.capture?.lat ?? null,
            in_lng: input.capture?.lng ?? null,
            in_captured_at: input.capture?.capturedAt ?? null,
            in_mock: input.capture?.mockLocation ?? false,
          });
          if (error) throw new Error(error.message);
          const row = Array.isArray(data) ? data[0] : data;
          const reportId = String(row.report_id);

          if (input.photoUri && uid) {
            try {
              const base64 = await FileSystem.readAsStringAsync(
                input.photoUri,
                { encoding: FileSystem.EncodingType.Base64 },
              );
              await supabase.storage
                .from("evidence")
                .upload(`${uid}/${reportId}.jpg`, decode(base64), {
                  contentType: "image/jpeg",
                });
            } catch {
              // evidence upload is best-effort; the report itself is filed
            }
          }
          await refresh();
          return {
            verification: row.verification as Verification,
            distanceM:
              row.distance_m == null ? undefined : Number(row.distance_m),
          };
        }

        // seed mode: keep the report locally
        const report: Report = {
          id: `local-${Date.now()}`,
          userId: LOCAL_USER,
          pumpId: input.pumpId,
          signals: input.signals,
          freeText: input.freeText,
          litres: input.litres,
          amountInr: input.amountInr,
          odoKm: input.odoKm,
          verification: input.verification,
          distanceToPumpM: input.distanceToPumpM,
          reportedAt: new Date().toISOString(),
          status: "published",
        };
        setLocalReports((prev) => [report, ...prev]);
        return {
          verification: input.verification,
          distanceM: input.distanceToPumpM,
        };
      },
    };
  }, [isLive, session, pumps, reports, localReports, loading, refresh]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
