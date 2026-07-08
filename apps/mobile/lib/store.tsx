import React, { createContext, useContext, useMemo, useState } from "react";
import {
  computePumpScore,
  type Pump,
  type PumpScore,
  type Report,
  type Signal,
} from "@tmp/shared";
import { SEED_PUMPS, SEED_REPORTS, SEED_TRUST_LEVELS } from "@tmp/shared/seed";

/**
 * In-memory store over the bundled seed data. Locally-filed reports are
 * appended so the whole flow works offline; swapping this for Supabase
 * queries is the backend milestone.
 */

export interface LocalReportInput {
  pumpId: string;
  signals: Signal[];
  freeText?: string;
  litres?: number;
  amountInr?: number;
  odoKm?: number;
  verification: Report["verification"];
  distanceToPumpM?: number;
  photoUri?: string;
}

interface Store {
  pumps: Pump[];
  reportsFor: (pumpId: string) => Report[];
  scoreFor: (pumpId: string) => PumpScore;
  myReports: Report[];
  addReport: (input: LocalReportInput) => Report;
}

const StoreContext = createContext<Store | null>(null);
const LOCAL_USER = "me";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [localReports, setLocalReports] = useState<Report[]>([]);

  const value = useMemo<Store>(() => {
    const all = [...localReports, ...SEED_REPORTS];
    return {
      pumps: SEED_PUMPS,
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
              reporterTrustLevel: SEED_TRUST_LEVELS[r.userId] ?? 0,
              reportedAt: r.reportedAt,
            })),
        ),
      myReports: localReports,
      addReport: (input) => {
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
        return report;
      },
    };
  }, [localReports]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
