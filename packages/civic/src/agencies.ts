/**
 * Registry of the civic agencies a report can route to. All portal data
 * below is real, sourced from official portals (source URLs noted per
 * entry, verified July 2026). Where an official portal could not be
 * verified, `portal`/`escalation` is null and CPGRAMS is the filing path —
 * we never invent URLs.
 *
 * Mirrored in the `civic_agencies` table seeded by
 * supabase/migrations/0007_civic_infra.sql — keep both in sync.
 */
import type { CityName } from "@tmp/shared";

export type AgencyKind = "ulb" | "state_pwd" | "nhai" | "pmgsy";

export interface AgencyPortal {
  /** Portal / scheme name, e.g. "PMC CARE", "MCD311". */
  name: string;
  /** Official URL; null when we could not verify one. */
  url: string | null;
  /** Companion mobile app, when the agency runs one. */
  appName?: string;
  /** Citizen helpline, when published. */
  helpline?: string;
}

export interface CivicAgency {
  slug: string;
  kind: AgencyKind;
  name: string;
  state: string;
  /** Set for ULBs only; matches CITIES names in @tmp/shared. */
  city?: CityName;
  /** First-stop complaint channel run by the agency itself. */
  portal: AgencyPortal | null;
  /** State-level grievance portal to escalate to when the agency stalls. */
  escalation: AgencyPortal | null;
}

/** Universal backstop for every agency: 30-day SLA, 5-level appeals. */
export const CPGRAMS_PORTAL: AgencyPortal = {
  name: "CPGRAMS",
  url: "https://pgportal.gov.in/",
};

/** Aaple Sarkar — Maharashtra's state grievance portal. */
const AAPLE_SARKAR: AgencyPortal = {
  name: "Aaple Sarkar Grievance Redressal",
  url: "https://grievances.maharashtra.gov.in/",
};

export const AGENCIES = {
  // ── Urban local bodies (one per pilot metro) ────────────────────────────
  "ulb-pune": {
    slug: "ulb-pune",
    kind: "ulb",
    name: "Pune Municipal Corporation",
    state: "Maharashtra",
    city: "Pune",
    // https://complaint.pmc.gov.in/ · PMC CARE app
    portal: {
      name: "PMC Complaint Management System",
      url: "https://complaint.pmc.gov.in/",
      appName: "PMC CARE",
    },
    escalation: AAPLE_SARKAR,
  },
  "ulb-mumbai": {
    slug: "ulb-mumbai",
    kind: "ulb",
    name: "Brihanmumbai Municipal Corporation",
    state: "Maharashtra",
    city: "Mumbai",
    // https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg · helpline 1916
    portal: {
      name: "MyBMC Complaint Registration",
      url: "https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg",
      appName: "MyBMC",
      helpline: "1916",
    },
    escalation: AAPLE_SARKAR,
  },
  "ulb-delhi": {
    slug: "ulb-delhi",
    kind: "ulb",
    name: "Municipal Corporation of Delhi",
    state: "Delhi",
    city: "Delhi",
    // https://mcdonline.nic.in/ · MCD311 app · helpline 1800-110-093
    portal: {
      name: "MCD311",
      url: "https://mcdonline.nic.in/",
      appName: "MCD311",
      helpline: "1800-110-093",
    },
    escalation: null, // Delhi PGMS portal URL not yet verified — CPGRAMS applies
  },
  "ulb-bengaluru": {
    slug: "ulb-bengaluru",
    kind: "ulb",
    name: "Bruhat Bengaluru Mahanagara Palike",
    state: "Karnataka",
    city: "Bengaluru",
    // https://bbmp.sahaaya.in/ · helpline 1533
    portal: {
      name: "BBMP Sahaaya",
      url: "https://bbmp.sahaaya.in/",
      appName: "Sahaaya 2.0",
      helpline: "1533",
    },
    escalation: null, // Karnataka IPGRS URL not yet verified — CPGRAMS applies
  },
  "ulb-hyderabad": {
    slug: "ulb-hyderabad",
    kind: "ulb",
    name: "Greater Hyderabad Municipal Corporation",
    state: "Telangana",
    city: "Hyderabad",
    // https://www.ghmc.gov.in/ (My City grievances) · helpline 040-21111111
    portal: {
      name: "GHMC Grievances",
      url: "https://www.ghmc.gov.in/",
      appName: "MyGHMC",
      helpline: "040-21111111",
    },
    escalation: null,
  },
  "ulb-chennai": {
    slug: "ulb-chennai",
    kind: "ulb",
    name: "Greater Chennai Corporation",
    state: "Tamil Nadu",
    city: "Chennai",
    // https://chennaicorporation.gov.in/ · helpline 1913 · Namma Chennai app
    portal: {
      name: "GCC Grievances",
      url: "https://chennaicorporation.gov.in/",
      appName: "Namma Chennai",
      helpline: "1913",
    },
    escalation: null,
  },
  "ulb-kolkata": {
    slug: "ulb-kolkata",
    kind: "ulb",
    name: "Kolkata Municipal Corporation",
    state: "West Bengal",
    city: "Kolkata",
    // https://www.kmcgov.in/KMCPortal/ComplaintFormAction.do
    portal: {
      name: "KMC Grievance Redressal",
      url: "https://www.kmcgov.in/KMCPortal/ComplaintFormAction.do",
    },
    escalation: null,
  },
  "ulb-ahmedabad": {
    slug: "ulb-ahmedabad",
    kind: "ulb",
    name: "Amdavad Municipal Corporation",
    state: "Gujarat",
    city: "Ahmedabad",
    // http://www.amccrs.com/ · AMC CCRS app · helpline 155303
    portal: {
      name: "AMC Comprehensive Complaint Redressal System",
      url: "http://www.amccrs.com/",
      appName: "AMC CCRS Official",
      helpline: "155303",
    },
    escalation: null,
  },

  // ── State PWDs (fallback outside ULB limits, per pilot state) ──────────
  "pwd-maharashtra": {
    slug: "pwd-maharashtra",
    kind: "state_pwd",
    name: "Maharashtra Public Works Department",
    state: "Maharashtra",
    // https://pwd.maharashtra.gov.in/en/grievance-redressal/
    portal: {
      name: "Maharashtra PWD Grievance Redressal",
      url: "https://pwd.maharashtra.gov.in/en/grievance-redressal/",
    },
    escalation: AAPLE_SARKAR,
  },
  "pwd-delhi": {
    slug: "pwd-delhi",
    kind: "state_pwd",
    name: "Public Works Department, Delhi",
    // PWD Sewa app confirmed (Delhi PWD launch, 2025); portal URL unverified
    state: "Delhi",
    portal: { name: "PWD Sewa", url: null, appName: "PWD Sewa" },
    escalation: null,
  },
  "pwd-karnataka": {
    slug: "pwd-karnataka",
    kind: "state_pwd",
    name: "Karnataka Public Works Department",
    state: "Karnataka",
    portal: null, // no verified direct portal — CPGRAMS applies
    escalation: null,
  },
  "pwd-telangana": {
    slug: "pwd-telangana",
    kind: "state_pwd",
    name: "Telangana Roads & Buildings Department",
    state: "Telangana",
    portal: null,
    escalation: null,
  },
  "pwd-tamil-nadu": {
    slug: "pwd-tamil-nadu",
    kind: "state_pwd",
    name: "Tamil Nadu Highways Department",
    state: "Tamil Nadu",
    portal: null,
    escalation: null,
  },
  "pwd-west-bengal": {
    slug: "pwd-west-bengal",
    kind: "state_pwd",
    name: "West Bengal Public Works Department",
    state: "West Bengal",
    portal: null,
    escalation: null,
  },
  "pwd-gujarat": {
    slug: "pwd-gujarat",
    kind: "state_pwd",
    name: "Gujarat Roads & Buildings Department",
    state: "Gujarat",
    portal: null,
    escalation: null,
  },

  // ── National agencies ──────────────────────────────────────────────────
  nhai: {
    slug: "nhai",
    kind: "nhai",
    name: "National Highways Authority of India",
    state: "India",
    // Rajmargyatra app + 1033 highway helpline (NHAI official channels)
    portal: {
      name: "NHAI Rajmargyatra",
      url: "https://nhai.gov.in/",
      appName: "Rajmargyatra",
      helpline: "1033",
    },
    escalation: null,
  },
  pmgsy: {
    slug: "pmgsy",
    kind: "pmgsy",
    name: "Pradhan Mantri Gram Sadak Yojana (NRIDA)",
    state: "India",
    // https://rural.nic.in/en/services/meri-sadak-pmgsy
    portal: {
      name: "Meri Sadak",
      url: "https://rural.nic.in/en/services/meri-sadak-pmgsy",
      appName: "Meri Sadak",
    },
    escalation: null,
  },
} as const satisfies Record<string, CivicAgency>;

export type AgencySlug = keyof typeof AGENCIES;

export const ALL_AGENCY_SLUGS = Object.keys(AGENCIES) as AgencySlug[];

export function isAgencySlug(s: string): s is AgencySlug {
  return s in AGENCIES;
}

/** State PWD agency for a state, or null for states outside the pilot. */
export function statePwdFor(state: string): CivicAgency | null {
  const match = ALL_AGENCY_SLUGS.map((s) => AGENCIES[s]).find(
    (a) => a.kind === "state_pwd" && a.state === state,
  );
  return match ?? null;
}
