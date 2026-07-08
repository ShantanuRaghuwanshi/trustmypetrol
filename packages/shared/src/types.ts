import type { Signal } from "./signals";

export type Omc =
  | "IOCL"
  | "BPCL"
  | "HPCL"
  | "NAYARA"
  | "JIO_BP"
  | "SHELL"
  | "OTHER";

export type PumpStatus = "active" | "closed" | "unverified";

export interface Blends {
  e10: boolean;
  e20: boolean;
  e100: boolean;
  /** Premium petrol that is still non-E20 where available */
  premium: boolean;
  cng: boolean;
}

export interface Pump {
  id: string;
  omc: Omc;
  dealerCode: string;
  name: string;
  address: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  blends: Blends;
  status: PumpStatus;
}

export type Verification = "geo_verified" | "location_mismatch" | "unverified";
export type ReportStatus = "published" | "pending_moderation" | "removed";

export interface Report {
  id: string;
  userId: string;
  pumpId: string;
  signals: Signal[];
  freeText?: string;
  odoKm?: number;
  litres?: number;
  amountInr?: number;
  verification: Verification;
  /** metres from the pump at capture; null when unverified */
  distanceToPumpM?: number;
  reportedAt: string; // ISO timestamp
  status: ReportStatus;
}

export type ScoreVerdict = "good" | "mixed" | "poor";

export interface PumpScore {
  pumpId: string;
  /** null when weighted report volume is below MIN_WEIGHTED_REPORTS */
  score: number | null;
  verdict: ScoreVerdict | null;
  reportCount: number;
  countedReports: number;
  geoVerifiedRatio: number;
  signalCounts: Partial<Record<Signal, number>>;
}

export type ComplaintChannel = "cpgrams" | "omc_portal" | "other";
export type ComplaintStatus = "drafted" | "filed" | "responded" | "closed";

export interface Complaint {
  id: string;
  userId: string;
  pumpId: string;
  reportId?: string;
  channel: ComplaintChannel;
  referenceNo?: string;
  status: ComplaintStatus;
  filedAt?: string;
}
