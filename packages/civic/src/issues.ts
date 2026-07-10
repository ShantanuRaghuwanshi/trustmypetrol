/**
 * The fixed civic issue vocabulary — the civic-infra analogue of the fuel
 * signal vocabulary in @tmp/shared. Reports select from these types, never
 * free-form accusations; scoring and contractor attribution (Phase 2) only
 * ever see counts of observable, photographable conditions.
 *
 * `clusterRadiusM` drives duplicate clustering: a new report of the same
 * type within this radius of an open issue attaches to that issue instead
 * of creating a new one (multiple reports = severity signal, not spam).
 * Radii reflect how spatially precise each condition is: a pothole is a
 * point defect, waterlogging covers a stretch.
 *
 * This table is mirrored in the `civic_issue_types` table seeded by
 * supabase/migrations/0007_civic_infra.sql — keep both in sync.
 */

export const ISSUE_CATEGORIES = {
  roads: { label: "Roads & footpaths" },
  drainage: { label: "Drainage & sewerage" },
  lighting: { label: "Street lighting & wiring" },
  sanitation: { label: "Garbage & sanitation" },
} as const;

export type IssueCategory = keyof typeof ISSUE_CATEGORIES;

export interface IssueTypeDef {
  label: string;
  /** One-line reporting hint shown in the app. */
  hint: string;
  category: IssueCategory;
  /**
   * Safety-critical issues (open manholes, exposed wiring) are flagged for
   * fast-track escalation and surfaced first in agency drafts.
   */
  safetyCritical: boolean;
  /** Duplicate-clustering radius in metres. */
  clusterRadiusM: number;
}

export const ISSUE_TYPES = {
  pothole: {
    label: "Pothole",
    hint: "Pothole or crater in the carriageway",
    category: "roads",
    safetyCritical: false,
    clusterRadiusM: 25,
  },
  road_surface_damage: {
    label: "Damaged road surface",
    hint: "Cracked, sunken, or eroded stretch of road",
    category: "roads",
    safetyCritical: false,
    clusterRadiusM: 50,
  },
  broken_footpath: {
    label: "Broken footpath",
    hint: "Broken, blocked, or missing footpath paving",
    category: "roads",
    safetyCritical: false,
    clusterRadiusM: 50,
  },
  debris_on_road: {
    label: "Debris / material on road",
    hint: "Construction debris or dumped material obstructing the road",
    category: "roads",
    safetyCritical: false,
    clusterRadiusM: 75,
  },
  open_manhole: {
    label: "Open / broken manhole",
    hint: "Manhole with a missing, broken, or displaced cover",
    category: "drainage",
    safetyCritical: true,
    clusterRadiusM: 25,
  },
  choked_drain: {
    label: "Choked drain",
    hint: "Blocked storm-water drain or roadside gutter",
    category: "drainage",
    safetyCritical: false,
    clusterRadiusM: 50,
  },
  sewage_overflow: {
    label: "Sewage overflow",
    hint: "Sewage overflowing onto the road or open ground",
    category: "drainage",
    safetyCritical: false,
    clusterRadiusM: 75,
  },
  waterlogging: {
    label: "Waterlogging",
    hint: "Standing water on the road after rain",
    category: "drainage",
    safetyCritical: false,
    clusterRadiusM: 150,
  },
  streetlight_out: {
    label: "Streetlight not working",
    hint: "Streetlight dark at night, or on during the day",
    category: "lighting",
    safetyCritical: false,
    clusterRadiusM: 30,
  },
  exposed_wiring: {
    label: "Exposed electrical wiring",
    hint: "Hanging or exposed live wires, open junction box",
    category: "lighting",
    safetyCritical: true,
    clusterRadiusM: 30,
  },
  garbage_blackspot: {
    label: "Garbage black-spot",
    hint: "Recurring open garbage dump or uncleared collection point",
    category: "sanitation",
    safetyCritical: false,
    clusterRadiusM: 75,
  },
} as const satisfies Record<string, IssueTypeDef>;

export type IssueType = keyof typeof ISSUE_TYPES;

export const ALL_ISSUE_TYPES = Object.keys(ISSUE_TYPES) as IssueType[];

export const SAFETY_CRITICAL_ISSUE_TYPES = ALL_ISSUE_TYPES.filter(
  (t) => ISSUE_TYPES[t].safetyCritical,
);

/** Reporter's on-the-spot severity read; refines clustering weight later. */
export type IssueSeverity = "minor" | "major" | "severe";

export const ISSUE_SEVERITIES: readonly IssueSeverity[] = [
  "minor",
  "major",
  "severe",
];

/** Clustering radius for a type; throws on unknown types (fail loud). */
export function clusterRadiusM(type: IssueType): number {
  return ISSUE_TYPES[type].clusterRadiusM;
}

/**
 * Whether a new report should attach to an existing open issue of the same
 * type at `distanceM`, rather than open a new issue. Mirrored inside
 * submit_civic_report() in SQL, which reads the radius from
 * civic_issue_types.
 */
export function shouldAttachToIssue(
  type: IssueType,
  distanceM: number,
): boolean {
  return distanceM <= clusterRadiusM(type);
}
