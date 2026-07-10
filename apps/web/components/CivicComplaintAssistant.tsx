"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AGENCIES,
  draftCivicGrievance,
  escalationLadder,
  isAgencySlug,
  isSlaLapsed,
  nextEscalation,
  slaDueDate,
  type CivicAgency,
  type CivicComplaint,
  type CivicComplaintChannel,
  type CivicIssue,
  type CivicReport,
  type IssueSeverity,
  type IssueType,
} from "@tmp/civic";
import type { Verification } from "@tmp/shared";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  });

function mapDbComplaint(row: Record<string, unknown>): CivicComplaint {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issueId: String(row.issue_id),
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

/**
 * Prepare, don't submit: drafts the grievance, deep-links the right portal
 * on the escalation ladder, then tracks the registration number against the
 * 30-day SLA. Signed-out visitors still get the draft and the links.
 */
export default function CivicComplaintAssistant({
  issue,
}: {
  issue: CivicIssue;
}) {
  const supabase = getSupabaseBrowser();
  const [uid, setUid] = useState<string | null>(null);
  const [myReport, setMyReport] = useState<CivicReport | undefined>();
  const [complaints, setComplaints] = useState<CivicComplaint[]>([]);
  const [refNo, setRefNo] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const agency: CivicAgency | null =
    issue.agencySlug && isAgencySlug(issue.agencySlug)
      ? AGENCIES[issue.agencySlug]
      : null;

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      setUid(userId);
      if (!userId) return;
      const [reportRes, complaintRes] = await Promise.all([
        supabase
          .from("civic_reports")
          .select("*")
          .eq("issue_id", issue.id)
          .eq("user_id", userId)
          .order("reported_at", { ascending: false })
          .limit(1),
        supabase
          .from("civic_complaints")
          .select("*")
          .eq("issue_id", issue.id)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      const r = reportRes.data?.[0] as Record<string, unknown> | undefined;
      if (r) {
        setMyReport({
          id: String(r.id),
          userId: String(r.user_id),
          issueId: String(r.issue_id),
          kind: r.kind as CivicReport["kind"],
          issueType: r.issue_type as IssueType,
          description: (r.description as string) ?? undefined,
          severity: (r.severity as IssueSeverity) ?? undefined,
          verification: r.verification as Verification,
          lat: Number(r.device_lat),
          lng: Number(r.device_lng),
          accuracyM: Number(r.accuracy_m),
          reportedAt: String(r.reported_at),
          status: r.status as CivicReport["status"],
        });
      }
      setComplaints((complaintRes.data ?? []).map(mapDbComplaint));
    })();
  }, [supabase, issue.id]);

  const draft = useMemo(
    () => draftCivicGrievance({ issue, report: myReport, agency }),
    [issue, myReport, agency],
  );

  const ladder = escalationLadder(agency);
  const active = complaints.find(
    (c) => c.status === "drafted" || c.status === "filed",
  );
  const activeStep =
    ladder.find((s) => s.channel === active?.channel) ?? ladder[0]!;

  async function beginFiling() {
    if (!supabase || !uid || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("civic_complaints")
        .insert({
          user_id: uid,
          issue_id: issue.id,
          channel: activeStep.channel,
          agency_slug: agency?.slug ?? null,
        })
        .select()
        .single();
      if (!error && data)
        setComplaints((prev) => [
          mapDbComplaint(data as Record<string, unknown>),
          ...prev,
        ]);
    } finally {
      setBusy(false);
    }
  }

  async function saveReference() {
    if (!supabase || !active || refNo.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("civic_complaints")
        .update({ status: "filed", reference_no: refNo.trim() })
        .eq("id", active.id)
        .select()
        .single();
      if (!error && data) {
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === active.id
              ? mapDbComplaint(data as Record<string, unknown>)
              : c,
          ),
        );
        setRefNo("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (!supabase || !uid || !active || busy) return;
    const next = nextEscalation(active.channel, agency);
    if (!next) return;
    setBusy(true);
    try {
      await supabase
        .from("civic_complaints")
        .update({ status: "escalated" })
        .eq("id", active.id);
      const { data } = await supabase
        .from("civic_complaints")
        .insert({
          user_id: uid,
          issue_id: issue.id,
          channel: next.channel,
          agency_slug: agency?.slug ?? null,
          escalated_from: active.id,
        })
        .select()
        .single();
      setComplaints((prev) => [
        ...(data ? [mapDbComplaint(data as Record<string, unknown>)] : []),
        ...prev.map((c) =>
          c.id === active.id
            ? { ...c, status: "escalated" as const }
            : c,
        ),
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 640 }}>
      <div className="panel">
        <div className="section-label" style={{ margin: "0 0 8px" }}>
          Drafted grievance · ready to paste
        </div>
        <p className="draft-text">{draft}</p>
        <button
          className="btn-outline"
          onClick={async () => {
            await navigator.clipboard.writeText(draft);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied ✓" : "Copy draft"}
        </button>
      </div>

      <div className="section-label" style={{ margin: 0 }}>
        Where to file — the escalation ladder
      </div>
      {ladder.map((step, i) => (
        <a
          key={step.channel}
          className={`panel channel${step.channel === activeStep.channel ? " primary" : ""}`}
          href={step.portal.url ?? undefined}
          target="_blank"
          rel="noreferrer"
        >
          <strong>
            {i + 1}. {step.portal.name}
            {step.portal.appName ? ` · ${step.portal.appName} app` : ""}
          </strong>
          <span className="pump-meta">
            {step.channel === "cpgrams"
              ? "Universal backstop · 30-day SLA, appeals after"
              : step.channel === "state_portal"
                ? "State grievance portal — escalate when the agency stalls"
                : `The agency's own channel — first stop${step.portal.helpline ? ` · helpline ${step.portal.helpline}` : ""}`}{" "}
            →
          </span>
        </a>
      ))}

      <div className="panel">
        <div className="section-label" style={{ margin: "0 0 8px" }}>
          Your filing
        </div>
        {!supabase || !uid ? (
          <p className="pump-meta" style={{ margin: 0 }}>
            Sign in to track your filing — registration number, the 30-day
            response window, and one-tap escalation up the ladder.
          </p>
        ) : !active ? (
          <button className="btn-primary" disabled={busy} onClick={beginFiling}>
            Start filing at {activeStep.portal.name}
          </button>
        ) : active.status === "drafted" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p className="pump-meta" style={{ margin: 0 }}>
              Paste the draft into {activeStep.portal.name}, then save the
              registration number — that starts the 30-day timer.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                placeholder="Registration / token no."
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-primary"
                disabled={refNo.trim().length < 4 || busy}
                onClick={saveReference}
              >
                Filed ✓
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <p style={{ margin: 0 }}>
              <strong>{active.referenceNo}</strong> · filed{" "}
              {active.filedAt ? dateIN(active.filedAt) : ""}
            </p>
            {active.filedAt && (
              <p className="pump-meta" style={{ margin: 0 }}>
                {isSlaLapsed(active.filedAt)
                  ? "30-day window lapsed — escalate up the ladder."
                  : `Response due by ${dateIN(slaDueDate(active.filedAt).toISOString())}.`}
              </p>
            )}
            {active.filedAt &&
              isSlaLapsed(active.filedAt) &&
              nextEscalation(active.channel, agency) && (
                <button className="btn-primary" disabled={busy} onClick={escalate}>
                  Escalate to{" "}
                  {nextEscalation(active.channel, agency)!.portal.name}
                </button>
              )}
          </div>
        )}
        {complaints.length > 1 && (
          <div style={{ marginTop: 10 }}>
            {complaints.map((c) => (
              <p key={c.id} className="pump-meta" style={{ margin: "2px 0" }}>
                {c.channel.replace("_", " ")} · {c.status}
                {c.referenceNo ? ` · ${c.referenceNo}` : ""} ·{" "}
                {dateIN(c.createdAt)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
