import type { Blends, Omc, Pump, Report } from "./types";
import type { Signal } from "./signals";

/**
 * Metro-city seed data. Pump names and dealer codes are illustrative
 * placeholders, not real outlets — replace with the OMC locator dataset
 * before any public launch. Report dates are generated relative to "now"
 * so demo scores don't decay as the repo ages.
 */

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString();

const seedId = (n: number) =>
  `0b8f1c2e-1111-4a01-9a01-${String(n).padStart(12, "0")}`;

const BLEND_DEFAULTS: Blends = {
  e20: true,
  higherBlends: false,
  e100: false,
  premium: false,
  cng: false,
};

/** Placeholder pumps for the other metros; ids continue after Pune's 1–8. */
const METRO_PUMPS: Array<{
  city: string;
  state: string;
  name: string;
  address: string;
  omc: Omc;
  code: string;
  lat: number;
  lng: number;
  blends?: Partial<Blends>;
}> = [
  // Delhi
  { city: "Delhi", state: "Delhi", name: "Connaught Fuel Services", address: "Barakhamba Road, Connaught Place", omc: "IOCL", code: "07-D-104", lat: 28.6315, lng: 77.2167, blends: { premium: true } },
  { city: "Delhi", state: "Delhi", name: "Saket Highway Station", address: "Press Enclave Road, Saket", omc: "BPCL", code: "BP-07-0412", lat: 28.5245, lng: 77.2066, blends: { cng: true } },
  { city: "Delhi", state: "Delhi", name: "Dwarka Sector Fuels", address: "Sector 12, Dwarka", omc: "HPCL", code: "DL-ND-0930", lat: 28.5921, lng: 77.046, blends: { higherBlends: true, cng: true } },
  { city: "Delhi", state: "Delhi", name: "Rohini Auto Point", address: "Outer Ring Road, Rohini", omc: "IOCL", code: "07-D-238", lat: 28.7383, lng: 77.0822 },
  // Mumbai
  { city: "Mumbai", state: "Maharashtra", name: "Andheri Link Fuels", address: "New Link Road, Andheri West", omc: "HPCL", code: "MH-MU-1145", lat: 19.1197, lng: 72.8468, blends: { premium: true } },
  { city: "Mumbai", state: "Maharashtra", name: "Bandra Sea Face Station", address: "SV Road, Bandra West", omc: "BPCL", code: "BP-27-0651", lat: 19.0596, lng: 72.8295, blends: { premium: true } },
  { city: "Mumbai", state: "Maharashtra", name: "Powai Lakeside Fuels", address: "Adi Shankaracharya Marg, Powai", omc: "IOCL", code: "27-M-322", lat: 19.1176, lng: 72.906, blends: { higherBlends: true } },
  { city: "Mumbai", state: "Maharashtra", name: "Dadar Central Services", address: "Dr Ambedkar Road, Dadar East", omc: "SHELL", code: "SH-MU-0088", lat: 19.0178, lng: 72.8478, blends: { premium: true } },
  // Bengaluru
  { city: "Bengaluru", state: "Karnataka", name: "Koramangala Fuel Hub", address: "80 Feet Road, Koramangala", omc: "IOCL", code: "29-B-517", lat: 12.9352, lng: 77.6245, blends: { premium: true } },
  { city: "Bengaluru", state: "Karnataka", name: "Whitefield Tech Fuels", address: "ITPL Main Road, Whitefield", omc: "HPCL", code: "KA-BL-2041", lat: 12.9698, lng: 77.75, blends: { higherBlends: true } },
  { city: "Bengaluru", state: "Karnataka", name: "Indiranagar Service Point", address: "100 Feet Road, Indiranagar", omc: "SHELL", code: "SH-BL-0119", lat: 12.9784, lng: 77.6408, blends: { premium: true } },
  { city: "Bengaluru", state: "Karnataka", name: "Jayanagar Auto Fuels", address: "4th Block, Jayanagar", omc: "BPCL", code: "BP-29-0774", lat: 12.9308, lng: 77.5838 },
  // Hyderabad
  { city: "Hyderabad", state: "Telangana", name: "Gachibowli Gateway Fuels", address: "Old Mumbai Highway, Gachibowli", omc: "HPCL", code: "TS-HY-1518", lat: 17.4401, lng: 78.3489, blends: { premium: true } },
  { city: "Hyderabad", state: "Telangana", name: "Banjara Hills Station", address: "Road No. 12, Banjara Hills", omc: "IOCL", code: "36-H-209", lat: 17.4156, lng: 78.4347, blends: { premium: true } },
  { city: "Hyderabad", state: "Telangana", name: "Secunderabad Junction Fuels", address: "SD Road, Secunderabad", omc: "BPCL", code: "BP-36-0343", lat: 17.4399, lng: 78.4983, blends: { cng: true } },
  { city: "Hyderabad", state: "Telangana", name: "Kukatpally Service Station", address: "JNTU Road, Kukatpally", omc: "NAYARA", code: "NY-HY-0221", lat: 17.4849, lng: 78.4138 },
  // Chennai
  { city: "Chennai", state: "Tamil Nadu", name: "T Nagar Fuel Point", address: "Usman Road, T Nagar", omc: "IOCL", code: "33-C-431", lat: 13.0418, lng: 80.2341, blends: { premium: true } },
  { city: "Chennai", state: "Tamil Nadu", name: "Anna Nagar Services", address: "2nd Avenue, Anna Nagar", omc: "HPCL", code: "TN-CH-1722", lat: 13.085, lng: 80.2101, blends: { higherBlends: true } },
  { city: "Chennai", state: "Tamil Nadu", name: "Velachery Bypass Fuels", address: "Velachery Main Road", omc: "BPCL", code: "BP-33-0866", lat: 12.9815, lng: 80.218 },
  { city: "Chennai", state: "Tamil Nadu", name: "Adyar River Station", address: "LB Road, Adyar", omc: "SHELL", code: "SH-CH-0074", lat: 13.0067, lng: 80.257, blends: { premium: true } },
  // Kolkata
  { city: "Kolkata", state: "West Bengal", name: "Salt Lake Sector Fuels", address: "Sector V, Salt Lake", omc: "IOCL", code: "19-K-612", lat: 22.5867, lng: 88.4171, blends: { premium: true } },
  { city: "Kolkata", state: "West Bengal", name: "Park Street Fuel Station", address: "AJC Bose Road, Park Street", omc: "HPCL", code: "WB-KO-1310", lat: 22.5535, lng: 88.352 },
  { city: "Kolkata", state: "West Bengal", name: "Behala Chowrasta Fuels", address: "Diamond Harbour Road, Behala", omc: "BPCL", code: "BP-19-0521", lat: 22.498, lng: 88.31 },
  { city: "Kolkata", state: "West Bengal", name: "Dum Dum Airport Services", address: "Jessore Road, Dum Dum", omc: "NAYARA", code: "NY-KO-0189", lat: 22.642, lng: 88.4312, blends: { cng: true } },
  // Ahmedabad
  { city: "Ahmedabad", state: "Gujarat", name: "Navrangpura Fuel Centre", address: "CG Road, Navrangpura", omc: "IOCL", code: "24-A-345", lat: 23.0365, lng: 72.5611, blends: { premium: true } },
  { city: "Ahmedabad", state: "Gujarat", name: "Satellite Ring Road Fuels", address: "Satellite Road", omc: "HPCL", code: "GJ-AH-1104", lat: 23.03, lng: 72.515, blends: { cng: true } },
  { city: "Ahmedabad", state: "Gujarat", name: "Maninagar Station", address: "Krishna Baug, Maninagar", omc: "BPCL", code: "BP-24-0618", lat: 22.9967, lng: 72.6031 },
  { city: "Ahmedabad", state: "Gujarat", name: "Bopal Crossing Fuels", address: "Bopal-Ambli Road", omc: "JIO_BP", code: "JB-AH-0042", lat: 23.0333, lng: 72.4645, blends: { higherBlends: true } },
];

const PUNE_PUMPS: Pump[] = [
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
    blends: { e20: true, higherBlends: false, e100: false, premium: false, cng: false },
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
    blends: { e20: true, higherBlends: true, e100: false, premium: true, cng: false },
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
    blends: { e20: true, higherBlends: false, e100: false, premium: true, cng: true },
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
    blends: { e20: true, higherBlends: false, e100: true, premium: false, cng: false },
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
    blends: { e20: true, higherBlends: true, e100: false, premium: true, cng: false },
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
    blends: { e20: true, higherBlends: false, e100: false, premium: false, cng: true },
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
    blends: { e20: true, higherBlends: false, e100: false, premium: true, cng: false },
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
    blends: { e20: true, higherBlends: true, e100: false, premium: true, cng: false },
    status: "active",
  },
];

export const SEED_PUMPS: Pump[] = [
  ...PUNE_PUMPS,
  ...METRO_PUMPS.map((m, i) => ({
    id: seedId(PUNE_PUMPS.length + i + 1),
    omc: m.omc,
    dealerCode: m.code,
    name: m.name,
    address: m.address,
    district: m.city,
    state: m.state,
    lat: m.lat,
    lng: m.lng,
    blends: { ...BLEND_DEFAULTS, ...m.blends },
    status: "active" as const,
  })),
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
  // Delhi — Connaught Fuel Services: good
  { pumpIdx: 8, user: "u40", ageDays: 2, signals: ["good_experience"], verified: true },
  { pumpIdx: 8, user: "u41", ageDays: 6, signals: ["good_experience"], verified: true },
  { pumpIdx: 8, user: "u42", ageDays: 11, signals: ["good_experience"], verified: true, trustLevel: 1 },
  { pumpIdx: 8, user: "u43", ageDays: 17, signals: ["no_e20_labelling"] },
  { pumpIdx: 8, user: "u44", ageDays: 24, signals: ["good_experience"], verified: true },
  { pumpIdx: 8, user: "u45", ageDays: 33, signals: ["good_experience"], verified: true },
  // Mumbai — Andheri Link Fuels: mixed
  { pumpIdx: 12, user: "u46", ageDays: 3, signals: ["mileage_drop"], verified: true },
  { pumpIdx: 12, user: "u47", ageDays: 8, signals: ["good_experience"], verified: true },
  { pumpIdx: 12, user: "u48", ageDays: 14, signals: ["short_fuelling"], verified: true },
  { pumpIdx: 12, user: "u49", ageDays: 21, signals: ["good_experience"] },
  { pumpIdx: 12, user: "u50", ageDays: 28, signals: ["good_experience"], verified: true },
  { pumpIdx: 12, user: "u51", ageDays: 36, signals: ["overcharge"] },
  // Bengaluru — Koramangala Fuel Hub: poor
  { pumpIdx: 16, user: "u52", ageDays: 1, signals: ["short_fuelling", "meter_issue"], verified: true },
  { pumpIdx: 16, user: "u53", ageDays: 5, signals: ["mileage_drop"], verified: true },
  { pumpIdx: 16, user: "u54", ageDays: 10, signals: ["short_fuelling"], verified: true, trustLevel: 1 },
  { pumpIdx: 16, user: "u55", ageDays: 16, signals: ["density_check_refused"], verified: true },
  { pumpIdx: 16, user: "u56", ageDays: 23, signals: ["good_experience"] },
  { pumpIdx: 16, user: "u57", ageDays: 30, signals: ["engine_trouble"], verified: true },
  // water/phase-separation reports (post-universal-E20 complaint category)
  { pumpIdx: 0, user: "u58", ageDays: 4, signals: ["water_in_fuel"], verified: true },
  { pumpIdx: 2, user: "u59", ageDays: 7, signals: ["water_in_fuel", "engine_trouble"], verified: true },
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

/** Dealer right-of-reply examples, keyed by report id. */
export const SEED_DEALER_RESPONSES: Record<string, string> = {
  "4e9d2c00-2222-4b02-8b02-000000000001":
    "Blend boards were installed on 3 Jul after this report. The density register is available on request — S. Patil, dealer.",
};
