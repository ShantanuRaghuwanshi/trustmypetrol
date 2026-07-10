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
import { CITIES, distanceMeters, type Verification } from "@tmp/shared";
import {
  AGENCIES,
  ALL_AGENCY_SLUGS,
  classifyCivicCapture,
  clusterRadiusM,
  slaDueDate,
  type AgencySlug,
  type CivicComplaint,
  type CivicComplaintChannel,
  type CivicIssue,
  type CivicReport,
  type CivicReportKind,
  type CivicRtiRequest,
  type CivicRtiStatus,
  type CivicWork,
  type IssueSeverity,
  type IssueType,
  type WorkSource,
} from "@tmp/civic";
import { supabase } from "@/lib/supabase";

/**
 * Civic-issue data store, sibling of lib/store.tsx (fuel). Live mode talks
 * to Supabase — submission goes through the submit_civic_report RPC, which
 * classifies, clusters, and routes server-side. Without env config it runs
 * in-memory so the flow still demos offline; local jurisdiction is a
 * documented heuristic (nearest pilot metro), PostGIS is authoritative.
 */

export interface CivicCaptureInput {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: string;
  mockLocation: boolean;
}

export interface CivicReportInput {
  issueType: IssueType;
  /** 'resolved_confirmation' = the community "is it actually fixed?" flow. */
  kind?: CivicReportKind;
  description?: string;
  severity?: IssueSeverity;
  capture: CivicCaptureInput;
  photoUri?: string;
}

export interface CivicSubmitResult {
  issueId: string;
  verification: Verification;
  agencySlug: string | null;
}

export interface BoardSnapInput {
  capture: CivicCaptureInput;
  photoUri?: string;
  rawText?: string;
  title?: string;
  contractorName?: string;
  costInr?: number;
  workOrderNo?: string;
  startDate?: string; // ISO yyyy-mm-dd
  completionDate?: string;
  dlpMonths?: number;
}

interface CivicStore {
  isLive: boolean;
  session: Session | null;
  loading: boolean;
  issues: CivicIssue[];
  myReports: CivicReport[];
  myComplaints: CivicComplaint[];
  myRtiRequests: CivicRtiRequest[];
  issueById: (id: string) => CivicIssue | undefined;
  myReportFor: (issueId: string) => CivicReport | undefined;
  complaintsFor: (issueId: string) => CivicComplaint[];
  refresh: () => Promise<void>;
  submitReport: (input: CivicReportInput) => Promise<CivicSubmitResult>;
  /** Insert a 'drafted' complaint row for a ladder rung. */
  startComplaint: (
    issueId: string,
    channel: CivicComplaintChannel,
    agencySlug: string | null,
    escalatedFrom?: string,
  ) => Promise<CivicComplaint>;
  /** Record the portal's registration number; server stamps the SLA. */
  markFiled: (complaintId: string, referenceNo: string) => Promise<void>;
  markEscalated: (complaintId: string) => Promise<void>;
  /** Works whose coverage circle contains the issue (registry lookup). */
  loadWorksFor: (issue: CivicIssue) => Promise<CivicWork[]>;
  /** "Snap the project board" — live app only (feeds moderation). */
  submitBoardSnap: (input: BoardSnapInput) => Promise<void>;
  startRti: (args: {
    issueId?: string;
    workId?: string;
    agencySlug: string | null;
    applicationText: string;
  }) => Promise<CivicRtiRequest>;
  markRtiFiled: (rtiId: string, referenceNo: string) => Promise<void>;
}

const CivicContext = createContext<CivicStore | null>(null);

const LOCAL_USER = "local-you";

/**
 * Offline heuristic only: attribute a point to the nearest pilot metro's
 * ULB when within ~30 km. The server's resolve_jurisdiction() (PostGIS,
 * real OSM boundaries) is authoritative in live mode.
 */
function localJurisdiction(lat: number, lng: number): AgencySlug | null {
  let best: { slug: AgencySlug; d: number } | null = null;
  for (const c of CITIES) {
    const d = distanceMeters(lat, lng, c.lat, c.lng);
    const slug = ALL_AGENCY_SLUGS.find(
      (s) => AGENCIES[s].kind === "ulb" && AGENCIES[s].city === c.name,
    );
    if (slug && d <= 30_000 && (!best || d < best.d)) best = { slug, d };
  }
  return best?.slug ?? null;
}

/* ---- row mappers (snake_case db → camelCase domain) ---- */

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

function mapDbRti(row: Record<string, unknown>): CivicRtiRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issueId: (row.issue_id as string | null) ?? null,
    workId: (row.work_id as string | null) ?? null,
    agencySlug: (row.agency_slug as string | null) ?? null,
    applicationText: (row.application_text as string | null) ?? null,
    referenceNo: (row.reference_no as string) ?? undefined,
    status: row.status as CivicRtiStatus,
    filedAt: (row.filed_at as string) ?? undefined,
    responseDueAt: (row.response_due_at as string) ?? undefined,
    createdAt: String(row.created_at),
  };
}

function mapDbComplaint(row: Record<string, unknown>): CivicComplaint {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issueId: String(row.issue_id),
    reportId: (row.report_id as string) ?? undefined,
    channel: row.channel as CivicComplaintChannel,
    agencySlug: (row.agency_slug as string | null) ?? null,
    referenceNo: (row.reference_no as string) ?? undefined,
    status: row.status as CivicComplaint["status"],
    filedAt: (row.filed_at as string) ?? undefined,
    slaDueAt: (row.sla_due_at as string) ?? undefined,
    escalatedFrom: (row.escalated_from as string) ?? undefined,
    createdAt: String(row.created_at),
  };
}

export function CivicStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLive = supabase !== null;
  const [session, setSession] = useState<Session | null>(null);
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [myReports, setMyReports] = useState<CivicReport[]>([]);
  const [myComplaints, setMyComplaints] = useState<CivicComplaint[]>([]);
  const [myRtiRequests, setMyRtiRequests] = useState<CivicRtiRequest[]>([]);
  const [worksByIssue, setWorksByIssue] = useState<
    Record<string, CivicWork[]>
  >({});
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
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const issuesRes = await supabase
      .from("civic_issues")
      .select("*")
      .order("last_reported_at", { ascending: false })
      .limit(1000);
    if (issuesRes.data) setIssues(issuesRes.data.map(mapDbIssue));
    if (uid) {
      const [reportsRes, complaintsRes, rtiRes] = await Promise.all([
        supabase
          .from("civic_reports")
          .select("*")
          .eq("user_id", uid)
          .order("reported_at", { ascending: false })
          .limit(200),
        supabase
          .from("civic_complaints")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("civic_rti_requests")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (reportsRes.data) setMyReports(reportsRes.data.map(mapDbCivicReport));
      if (complaintsRes.data)
        setMyComplaints(complaintsRes.data.map(mapDbComplaint));
      if (rtiRes.data) setMyRtiRequests(rtiRes.data.map(mapDbRti));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLive) void refresh();
  }, [isLive, refresh]);

  const value = useMemo<CivicStore>(() => {
    const uid = session?.user.id;
    return {
      isLive,
      session,
      loading,
      issues,
      myReports,
      myComplaints,
      myRtiRequests,
      issueById: (id) => issues.find((i) => i.id === id),
      myReportFor: (issueId) =>
        myReports.find((r) => r.issueId === issueId && r.kind === "report"),
      complaintsFor: (issueId) =>
        myComplaints.filter((c) => c.issueId === issueId),

      refresh,

      submitReport: async (input) => {
        if (supabase) {
          const { data, error } = await supabase.rpc("submit_civic_report", {
            in_issue_type: input.issueType,
            in_lat: input.capture.lat,
            in_lng: input.capture.lng,
            in_accuracy_m: input.capture.accuracyM,
            in_captured_at: input.capture.capturedAt,
            in_mock: input.capture.mockLocation,
            in_kind: input.kind ?? "report",
            in_description: input.description ?? null,
            in_severity: input.severity ?? null,
          });
          if (error) throw new Error(error.message);
          const row = (Array.isArray(data) ? data[0] : data) as Record<
            string,
            unknown
          >;
          const reportId = String(row.report_id);
          if (input.photoUri && uid) {
            try {
              const base64 = await FileSystem.readAsStringAsync(
                input.photoUri,
                { encoding: FileSystem.EncodingType.Base64 },
              );
              await supabase.storage
                .from("evidence")
                .upload(`${uid}/civic-${reportId}.jpg`, decode(base64), {
                  contentType: "image/jpeg",
                });
            } catch {
              // evidence upload is best-effort; the report itself is filed
            }
          }
          await refresh();
          return {
            issueId: String(row.issue_id),
            verification: row.verification as Verification,
            agencySlug: (row.agency_slug as string | null) ?? null,
          };
        }

        // offline mode: client-side clustering + heuristic jurisdiction
        const kind = input.kind ?? "report";
        const verification = classifyCivicCapture({
          accuracyM: input.capture.accuracyM,
          capturedAt: input.capture.capturedAt,
          receivedAt: new Date().toISOString(),
          mockLocation: input.capture.mockLocation,
        });
        const near = issues.find(
          (i) =>
            i.issueType === input.issueType &&
            distanceMeters(i.lat, i.lng, input.capture.lat, input.capture.lng) <=
              clusterRadiusM(input.issueType),
        );
        if (kind === "resolved_confirmation" && !near) {
          throw new Error("no open issue here to confirm as resolved");
        }
        const now = new Date().toISOString();
        let issue: CivicIssue;
        if (near) {
          // Single-user device: one confirmation resolves locally (the live
          // server requires RESOLVED_CONFIRMATIONS_REQUIRED distinct users);
          // a fresh report on a resolved issue reopens it, mirroring 0009.
          issue = {
            ...near,
            reportCount: near.reportCount + 1,
            lastReportedAt: now,
            ...(kind === "resolved_confirmation"
              ? { status: "resolved" as const, resolvedAt: now }
              : near.status === "resolved"
                ? { status: "reopened" as const, resolvedAt: null }
                : {}),
          };
          setIssues((prev) => prev.map((i) => (i.id === near.id ? issue : i)));
        } else {
          const slug = localJurisdiction(input.capture.lat, input.capture.lng);
          issue = {
            id: `local-${Date.now()}`,
            issueType: input.issueType,
            status: "open",
            lat: input.capture.lat,
            lng: input.capture.lng,
            agencyKind: slug ? "ulb" : "unresolved",
            agencySlug: slug,
            roadRef: null,
            reportCount: 1,
            firstReportedAt: now,
            lastReportedAt: now,
            resolvedAt: null,
          };
          setIssues((prev) => [issue, ...prev]);
        }
        setMyReports((prev) => [
          {
            id: `local-r-${Date.now()}`,
            userId: LOCAL_USER,
            issueId: issue.id,
            kind,
            issueType: input.issueType,
            description: input.description,
            severity: input.severity,
            verification,
            lat: input.capture.lat,
            lng: input.capture.lng,
            accuracyM: input.capture.accuracyM,
            reportedAt: now,
            status: "published",
          },
          ...prev,
        ]);
        return { issueId: issue.id, verification, agencySlug: issue.agencySlug };
      },

      startComplaint: async (issueId, channel, agencySlug, escalatedFrom) => {
        if (supabase && uid) {
          const { data, error } = await supabase
            .from("civic_complaints")
            .insert({
              user_id: uid,
              issue_id: issueId,
              channel,
              agency_slug: agencySlug,
              escalated_from: escalatedFrom ?? null,
            })
            .select()
            .single();
          if (error) throw new Error(error.message);
          const complaint = mapDbComplaint(data as Record<string, unknown>);
          setMyComplaints((prev) => [complaint, ...prev]);
          return complaint;
        }
        const complaint: CivicComplaint = {
          id: `local-c-${Date.now()}`,
          userId: LOCAL_USER,
          issueId,
          channel,
          agencySlug,
          status: "drafted",
          escalatedFrom,
          createdAt: new Date().toISOString(),
        };
        setMyComplaints((prev) => [complaint, ...prev]);
        return complaint;
      },

      markFiled: async (complaintId, referenceNo) => {
        if (supabase) {
          const { error } = await supabase
            .from("civic_complaints")
            .update({ status: "filed", reference_no: referenceNo })
            .eq("id", complaintId);
          if (error) throw new Error(error.message);
          await refresh();
          return;
        }
        const filedAt = new Date().toISOString();
        setMyComplaints((prev) =>
          prev.map((c) =>
            c.id === complaintId
              ? {
                  ...c,
                  status: "filed",
                  referenceNo,
                  filedAt,
                  slaDueAt: slaDueDate(filedAt).toISOString(),
                }
              : c,
          ),
        );
      },

      loadWorksFor: async (issue) => {
        const cached = worksByIssue[issue.id];
        if (cached) return cached;
        if (!supabase) return []; // registry is server data; nothing offline
        const { data, error } = await supabase.rpc("civic_works_near", {
          in_lat: issue.lat,
          in_lng: issue.lng,
        });
        if (error) throw new Error(error.message);
        const works = ((data ?? []) as Record<string, unknown>[]).map(
          mapDbWork,
        );
        setWorksByIssue((prev) => ({ ...prev, [issue.id]: works }));
        return works;
      },

      submitBoardSnap: async (input) => {
        if (!supabase || !uid) {
          throw new Error(
            "Board submissions feed the public works registry and need the live app — sign in and try again.",
          );
        }
        const { data, error } = await supabase
          .from("civic_work_submissions")
          .insert({
            user_id: uid,
            device_lat: input.capture.lat,
            device_lng: input.capture.lng,
            accuracy_m: Math.round(input.capture.accuracyM * 10) / 10,
            raw_text: input.rawText ?? null,
            title: input.title ?? null,
            contractor_name: input.contractorName ?? null,
            cost_inr: input.costInr ?? null,
            work_order_no: input.workOrderNo ?? null,
            start_date: input.startDate ?? null,
            completion_date: input.completionDate ?? null,
            dlp_months: input.dlpMonths ?? null,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (input.photoUri && data) {
          try {
            const base64 = await FileSystem.readAsStringAsync(input.photoUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await supabase.storage
              .from("evidence")
              .upload(`${uid}/board-${String(data.id)}.jpg`, decode(base64), {
                contentType: "image/jpeg",
              });
          } catch {
            // photo upload is best-effort; the transcription is submitted
          }
        }
      },

      startRti: async ({ issueId, workId, agencySlug, applicationText }) => {
        if (supabase && uid) {
          const { data, error } = await supabase
            .from("civic_rti_requests")
            .insert({
              user_id: uid,
              issue_id: issueId ?? null,
              work_id: workId ?? null,
              agency_slug: agencySlug,
              application_text: applicationText,
            })
            .select()
            .single();
          if (error) throw new Error(error.message);
          const rti = mapDbRti(data as Record<string, unknown>);
          setMyRtiRequests((prev) => [rti, ...prev]);
          return rti;
        }
        const rti: CivicRtiRequest = {
          id: `local-rti-${Date.now()}`,
          userId: LOCAL_USER,
          issueId: issueId ?? null,
          workId: workId ?? null,
          agencySlug,
          applicationText,
          status: "drafted",
          createdAt: new Date().toISOString(),
        };
        setMyRtiRequests((prev) => [rti, ...prev]);
        return rti;
      },

      markRtiFiled: async (rtiId, referenceNo) => {
        if (supabase) {
          const { error } = await supabase
            .from("civic_rti_requests")
            .update({ status: "filed", reference_no: referenceNo })
            .eq("id", rtiId);
          if (error) throw new Error(error.message);
          await refresh();
          return;
        }
        const filedAt = new Date().toISOString();
        setMyRtiRequests((prev) =>
          prev.map((r) =>
            r.id === rtiId
              ? {
                  ...r,
                  status: "filed",
                  referenceNo,
                  filedAt,
                  responseDueAt: new Date(
                    new Date(filedAt).getTime() + 30 * 86_400_000,
                  ).toISOString(),
                }
              : r,
          ),
        );
      },

      markEscalated: async (complaintId) => {
        if (supabase) {
          const { error } = await supabase
            .from("civic_complaints")
            .update({ status: "escalated" })
            .eq("id", complaintId);
          if (error) throw new Error(error.message);
          await refresh();
          return;
        }
        setMyComplaints((prev) =>
          prev.map((c) =>
            c.id === complaintId ? { ...c, status: "escalated" } : c,
          ),
        );
      },
    };
  }, [
    isLive,
    session,
    loading,
    issues,
    myReports,
    myComplaints,
    myRtiRequests,
    worksByIssue,
    refresh,
  ]);

  return (
    <CivicContext.Provider value={value}>{children}</CivicContext.Provider>
  );
}

export function useCivicStore(): CivicStore {
  const store = useContext(CivicContext);
  if (!store) throw new Error("useCivicStore outside CivicStoreProvider");
  return store;
}
