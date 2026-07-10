"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AGENCIES,
  draftRtiApplication,
  isAgencySlug,
  rtiDueDate,
  rtiPortalFor,
  type CivicAgency,
  type CivicIssue,
  type CivicRtiRequest,
  type CivicRtiStatus,
  type CivicWork,
} from "@tmp/civic";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  });

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

/**
 * RTI assistant: a ₹10 application gets the work order, contractor, and DLP
 * clause on the record — the 30-day deadline is statutory (s.7(1), RTI Act).
 * Prepare, don't submit; signed-out visitors still get the full draft.
 */
export default function RtiAssistant({
  issue,
  work,
}: {
  issue: CivicIssue;
  work: CivicWork | null;
}) {
  const supabase = getSupabaseBrowser();
  const [uid, setUid] = useState<string | null>(null);
  const [mine, setMine] = useState<CivicRtiRequest | null>(null);
  const [refNo, setRefNo] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const agency: CivicAgency | null =
    issue.agencySlug && isAgencySlug(issue.agencySlug)
      ? AGENCIES[issue.agencySlug]
      : null;

  const draft = useMemo(
    () => draftRtiApplication({ issue, agency, work: work ?? undefined }),
    [issue, agency, work],
  );
  const portal = rtiPortalFor(agency);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      setUid(userId);
      if (!userId) return;
      const { data } = await supabase
        .from("civic_rti_requests")
        .select("*")
        .eq("issue_id", issue.id)
        .eq("user_id", userId)
        .in("status", ["drafted", "filed"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) setMine(mapDbRti(data[0] as Record<string, unknown>));
    })();
  }, [supabase, issue.id]);

  async function start() {
    if (!supabase || !uid || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("civic_rti_requests")
        .insert({
          user_id: uid,
          issue_id: issue.id,
          work_id: work?.id ?? null,
          agency_slug: agency?.slug ?? null,
          application_text: draft,
        })
        .select()
        .single();
      if (!error && data) setMine(mapDbRti(data as Record<string, unknown>));
    } finally {
      setBusy(false);
    }
  }

  async function saveReference() {
    if (!supabase || !mine || refNo.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("civic_rti_requests")
        .update({ status: "filed", reference_no: refNo.trim() })
        .eq("id", mine.id)
        .select()
        .single();
      if (!error && data) {
        setMine(mapDbRti(data as Record<string, unknown>));
        setRefNo("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-label" style={{ margin: "0 0 8px" }}>
        RTI — get the contract on record
      </div>
      <p className="pump-meta" style={{ marginTop: 0 }}>
        A ₹10 RTI application gets the work order, contractor name, and defect
        liability clause for this location. Response due in 30 days by
        statute.
      </p>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          View drafted application
        </summary>
        <p className="draft-text" style={{ whiteSpace: "pre-wrap" }}>
          {draft}
        </p>
      </details>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button
          className="btn-outline"
          onClick={async () => {
            await navigator.clipboard.writeText(draft);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied ✓" : "Copy application"}
        </button>
        {portal?.url && (
          <a
            className="btn-outline"
            href={portal.url}
            target="_blank"
            rel="noreferrer"
          >
            File at {portal.name} →
          </a>
        )}
      </div>
      {!portal && (
        <p className="pump-meta" style={{ marginBottom: 0 }}>
          No verified online RTI portal for this agency — file with its Public
          Information Officer by post or in person.
        </p>
      )}

      {supabase && uid && (
        <div style={{ marginTop: 12 }}>
          {!mine ? (
            <button className="btn-primary" disabled={busy} onClick={start}>
              Track an RTI for this issue
            </button>
          ) : mine.status === "drafted" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                placeholder="RTI registration no."
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
          ) : (
            <p style={{ margin: 0 }}>
              <strong>{mine.referenceNo}</strong>
              {mine.filedAt && (
                <span className="pump-meta">
                  {" "}
                  · response due{" "}
                  {dateIN(rtiDueDate(mine.filedAt).toISOString())} (statutory)
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
