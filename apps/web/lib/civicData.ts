import { createClient } from "@supabase/supabase-js";
import type { Verification } from "@tmp/shared";
import type {
  AgencySlug,
  CivicIssue,
  CivicReport,
  CivicWork,
  IssueSeverity,
  IssueType,
  WorkSource,
} from "@tmp/civic";

/**
 * Server-side civic data access. Unlike lib/data.ts there is no bundled
 * seed fallback — civic issues are real citizen reports and we never show
 * fabricated ones. Without Supabase env the pages render an honest empty
 * state.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const civicLive = supabase !== null;

export async function getCivicIssues(): Promise<CivicIssue[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("civic_issues")
    .select("*")
    .order("last_reported_at", { ascending: false })
    .limit(1000);
  return (data ?? []).map(mapDbIssue);
}

export async function getCivicIssue(id: string): Promise<CivicIssue | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("civic_issues")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapDbIssue(data) : null;
}

/** Published reports attached to an issue (public map surface). */
export async function getIssueReports(issueId: string): Promise<CivicReport[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("civic_reports")
    .select("*")
    .eq("issue_id", issueId)
    .eq("status", "published")
    .order("reported_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(mapDbCivicReport);
}

/** Full works registry (contractor scorecards are computed in app code). */
export async function getCivicWorks(): Promise<CivicWork[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("civic_works")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  return ((data ?? []) as Record<string, unknown>[]).map(mapDbWork);
}

/** Works whose coverage circle contains the point (registry lookup). */
export async function getWorksNear(
  lat: number,
  lng: number,
): Promise<CivicWork[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc("civic_works_near", {
    in_lat: lat,
    in_lng: lng,
  });
  return ((data ?? []) as Record<string, unknown>[]).map(mapDbWork);
}

/* ---- row mappers (snake_case db → camelCase domain) ---- */

function mapDbWork(row: Record<string, unknown>): CivicWork {
  return {
    id: String(row.id),
    agencySlug: (row.agency_slug as string | null) ?? null,
    title: String(row.title),
    contractorName: (row.contractor_name as string | null) ?? null,
    costInr: row.cost_inr == null ? null : Number(row.cost_inr),
    workOrderNo: (row.work_order_no as string | null) ?? null,
    startDate: (row.start_date as string | null) ?? null,
    completionDate: (row.completion_date as string | null) ?? null,
    dlpMonths: row.dlp_months == null ? null : Number(row.dlp_months),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    coverageRadiusM: Number(row.coverage_radius_m),
    source: row.source as WorkSource,
    sourceRef: (row.source_ref as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    verified: Boolean(row.verified),
    createdAt: String(row.created_at),
  };
}

function mapDbIssue(row: Record<string, unknown>): CivicIssue {
  return {
    id: String(row.id),
    issueType: row.issue_type as IssueType,
    status: row.status as CivicIssue["status"],
    lat: Number(row.lat),
    lng: Number(row.lng),
    agencyKind:
      (row.agency_kind as CivicIssue["agencyKind"] | null) ?? "unresolved",
    agencySlug: (row.agency_slug as AgencySlug | null) ?? null,
    roadRef: (row.road_ref as string | null) ?? null,
    reportCount: Number(row.report_count),
    firstReportedAt: String(row.first_reported_at),
    lastReportedAt: String(row.last_reported_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  };
}

function mapDbCivicReport(row: Record<string, unknown>): CivicReport {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issueId: String(row.issue_id),
    kind: row.kind as CivicReport["kind"],
    issueType: row.issue_type as IssueType,
    description: (row.description as string) ?? undefined,
    severity: (row.severity as IssueSeverity) ?? undefined,
    verification: row.verification as Verification,
    lat: Number(row.device_lat),
    lng: Number(row.device_lng),
    accuracyM: Number(row.accuracy_m),
    reportedAt: String(row.reported_at),
    status: row.status as CivicReport["status"],
  };
}
