import type { Pump, Report } from "./types";
import type { Signal } from "./signals";

/**
 * Pune pilot seed data. Pump names and dealer codes are illustrative
 * placeholders, not real outlets — replace with the OMC locator dataset
 * before any public launch. Report dates are generated relative to "now"
 * so demo scores don't decay as the repo ages.
 */

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString();

export const SEED_PUMPS: Pump[] = [
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000001",
    omc: "IOCL",
    dealerCode: "41-C-118",
    name: "Shree Ganesh Fuels",
    address: "Baner Road, near Sakal Nagar",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5590,
    lng: 73.7868,
    blends: { e10: false, e20: true, e100: false, premium: false, cng: false },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000002",
    omc: "HPCL",
    dealerCode: "MH-PN-2214",
    name: "Aundh Service Station",
    address: "DP Road, Aundh",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5628,
    lng: 73.8079,
    blends: { e10: true, e20: true, e100: false, premium: true, cng: false },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000003",
    omc: "BPCL",
    dealerCode: "BP-41-0672",
    name: "Kothrud Highway Services",
    address: "Paud Road, Kothrud",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5074,
    lng: 73.8077,
    blends: { e10: false, e20: true, e100: false, premium: true, cng: true },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000004",
    omc: "IOCL",
    dealerCode: "41-C-231",
    name: "Hinjewadi Fuel Point",
    address: "Phase 1, Hinjewadi IT Park Road",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5913,
    lng: 73.7389,
    blends: { e10: false, e20: true, e100: true, premium: false, cng: false },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000005",
    omc: "HPCL",
    dealerCode: "MH-PN-1830",
    name: "Deccan Petro Services",
    address: "FC Road, Deccan Gymkhana",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5177,
    lng: 73.8415,
    blends: { e10: true, e20: true, e100: false, premium: true, cng: false },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000006",
    omc: "NAYARA",
    dealerCode: "NY-PN-0410",
    name: "Hadapsar Auto Fuels",
    address: "Pune–Solapur Road, Hadapsar",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5089,
    lng: 73.9260,
    blends: { e10: false, e20: true, e100: false, premium: false, cng: true },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000007",
    omc: "BPCL",
    dealerCode: "BP-41-0951",
    name: "Viman Nagar Fuel Stop",
    address: "Airport Road, Viman Nagar",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5679,
    lng: 73.9143,
    blends: { e10: false, e20: true, e100: false, premium: true, cng: false },
    status: "active",
  },
  {
    id: "0b8f1c2e-1111-4a01-9a01-000000000008",
    omc: "JIO_BP",
    dealerCode: "JB-PN-0087",
    name: "Wakad Mobility Station",
    address: "Hinjewadi–Wakad Road",
    district: "Pune",
    state: "Maharashtra",
    lat: 18.5989,
    lng: 73.7707,
    blends: { e10: true, e20: true, e100: false, premium: true, cng: false },
    status: "active",
  },
];

interface SeedReportSpec {
  pumpIdx: number;
  user: string;
  ageDays: number;
  signals: Signal[];
  verified?: boolean;
  freeText?: string;
  litres?: number;
  amountInr?: number;
  trustLevel?: number;
}

const specs: SeedReportSpec[] = [
  // Pump 1 — Shree Ganesh Fuels: mixed, trending bad
  { pumpIdx: 0, user: "u01", ageDays: 2,  signals: ["mileage_drop", "no_e20_labelling"], verified: true, litres: 4.96, amountInr: 520, freeText: "Activa dropped from 48 to 39 km/l after two fills here. No blend board on any dispenser." },
  { pumpIdx: 0, user: "u02", ageDays: 5,  signals: ["mileage_drop"], verified: true },
  { pumpIdx: 0, user: "u03", ageDays: 9,  signals: ["short_fuelling"], verified: true },
  { pumpIdx: 0, user: "u04", ageDays: 12, signals: ["good_experience"], verified: true },
  { pumpIdx: 0, user: "u05", ageDays: 15, signals: ["mileage_drop", "engine_trouble"] },
  { pumpIdx: 0, user: "u06", ageDays: 21, signals: ["good_experience"], verified: true, trustLevel: 1 },
  { pumpIdx: 0, user: "u07", ageDays: 30, signals: ["density_check_refused"], verified: true },
  { pumpIdx: 0, user: "u08", ageDays: 44, signals: ["mileage_drop"] },
  // Pump 2 — Aundh: good
  { pumpIdx: 1, user: "u02", ageDays: 3,  signals: ["good_experience"], verified: true },
  { pumpIdx: 1, user: "u09", ageDays: 7,  signals: ["good_experience"], verified: true, trustLevel: 1 },
  { pumpIdx: 1, user: "u10", ageDays: 11, signals: ["good_experience"], verified: true },
  { pumpIdx: 1, user: "u11", ageDays: 18, signals: ["mileage_drop"] },
  { pumpIdx: 1, user: "u12", ageDays: 25, signals: ["good_experience"], verified: true },
  { pumpIdx: 1, user: "u13", ageDays: 33, signals: ["good_experience"], verified: true },
  // Pump 3 — Kothrud: poor
  { pumpIdx: 2, user: "u14", ageDays: 1,  signals: ["short_fuelling", "meter_issue"], verified: true, litres: 2.0, amountInr: 210 },
  { pumpIdx: 2, user: "u15", ageDays: 4,  signals: ["short_fuelling"], verified: true },
  { pumpIdx: 2, user: "u16", ageDays: 8,  signals: ["overcharge"], verified: true },
  { pumpIdx: 2, user: "u17", ageDays: 13, signals: ["short_fuelling"], verified: true, trustLevel: 1 },
  { pumpIdx: 2, user: "u18", ageDays: 19, signals: ["good_experience"] },
  { pumpIdx: 2, user: "u19", ageDays: 27, signals: ["meter_issue"], verified: true },
  // Pump 4 — Hinjewadi: not enough data
  { pumpIdx: 3, user: "u20", ageDays: 6,  signals: ["good_experience"], verified: true },
  { pumpIdx: 3, user: "u21", ageDays: 40, signals: ["blend_update"] },
  // Pump 5 — Deccan: good
  { pumpIdx: 4, user: "u22", ageDays: 2,  signals: ["good_experience"], verified: true },
  { pumpIdx: 4, user: "u23", ageDays: 6,  signals: ["good_experience"], verified: true },
  { pumpIdx: 4, user: "u24", ageDays: 10, signals: ["good_experience"], verified: true, trustLevel: 1 },
  { pumpIdx: 4, user: "u25", ageDays: 16, signals: ["good_experience"] },
  { pumpIdx: 4, user: "u26", ageDays: 24, signals: ["no_e20_labelling"], verified: true },
  { pumpIdx: 4, user: "u27", ageDays: 31, signals: ["good_experience"], verified: true },
  // Pump 6 — Hadapsar: mixed
  { pumpIdx: 5, user: "u28", ageDays: 3,  signals: ["engine_trouble"], verified: true },
  { pumpIdx: 5, user: "u29", ageDays: 9,  signals: ["good_experience"], verified: true },
  { pumpIdx: 5, user: "u30", ageDays: 14, signals: ["good_experience"] },
  { pumpIdx: 5, user: "u31", ageDays: 20, signals: ["mileage_drop"], verified: true },
  { pumpIdx: 5, user: "u32", ageDays: 29, signals: ["good_experience"], verified: true },
  { pumpIdx: 5, user: "u33", ageDays: 38, signals: ["good_experience"] },
  // Pump 7 — Viman Nagar: good
  { pumpIdx: 6, user: "u34", ageDays: 4,  signals: ["good_experience"], verified: true },
  { pumpIdx: 6, user: "u35", ageDays: 12, signals: ["good_experience"], verified: true },
  { pumpIdx: 6, user: "u36", ageDays: 17, signals: ["good_experience"], verified: true },
  { pumpIdx: 6, user: "u37", ageDays: 23, signals: ["overcharge"] },
  { pumpIdx: 6, user: "u38", ageDays: 35, signals: ["good_experience"], verified: true },
  // Pump 8 — Wakad: not enough data
  { pumpIdx: 7, user: "u39", ageDays: 8, signals: ["good_experience"], verified: true },
];

export const SEED_REPORTS: Report[] = specs.map((s, i) => {
  const pump = SEED_PUMPS[s.pumpIdx]!;
  return {
    id: `4e9d2c00-2222-4b02-8b02-${String(i + 1).padStart(12, "0")}`,
    userId: s.user,
    pumpId: pump.id,
    signals: s.signals,
    freeText: s.freeText,
    litres: s.litres,
    amountInr: s.amountInr,
    verification: s.verified ? "geo_verified" : "unverified",
    distanceToPumpM: s.verified ? 20 + ((i * 13) % 110) : undefined,
    reportedAt: daysAgo(s.ageDays),
    status: "published",
  };
});

/** Reporter trust levels for seed users (score weighting). */
export const SEED_TRUST_LEVELS: Record<string, number> = Object.fromEntries(
  specs.filter((s) => s.trustLevel).map((s) => [s.user, s.trustLevel!]),
);
