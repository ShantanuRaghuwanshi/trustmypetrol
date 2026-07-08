"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COMPLAINT_CHANNELS,
  draftGrievance,
  type Pump,
  type Report,
} from "@tmp/shared";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ComplaintAssistant({
  pump,
  fallbackReports,
}: {
  pump: Pump;
  fallbackReports: Report[];
}) {
  const supabase = getSupabaseBrowser();
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [copied, setCopied] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [tracked, setTracked] = useState<string | null>(null);

  // prefer the signed-in user's own report for this pump
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("pump_id", pump.id)
        .eq("user_id", uid)
        .order("reported_at", { ascending: false })
        .limit(1);
      if (data?.length) {
        const r = data[0] as Record<string, unknown>;
        setMyReports([
          {
            id: String(r.id),
            userId: String(r.user_id),
            pumpId: String(r.pump_id),
            signals: r.signals as Report["signals"],
            freeText: (r.free_text as string) ?? undefined,
            litres: r.litres == null ? undefined : Number(r.litres),
            amountInr:
              r.amount_inr == null ? undefined : Number(r.amount_inr),
            verification: r.verification as Report["verification"],
            distanceToPumpM:
              r.distance_to_pump_m == null
                ? undefined
                : Number(r.distance_to_pump_m),
            reportedAt: String(r.reported_at),
            status: r.status as Report["status"],
          },
        ]);
      }
    })();
  }, [supabase, pump.id]);

  const report = myReports[0] ?? fallbackReports[0] ?? null;
  const draft = useMemo(
    () => (report ? draftGrievance(pump, report) : null),
    [pump, report],
  );

  const cpgrams = COMPLAINT_CHANNELS[0]!;
  const omcPortal = COMPLAINT_CHANNELS[1]!;
  const omcUrl = omcPortal.urlByOmc?.[pump.omc];

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 640 }}>
      <div className="panel">
        <div className="section-label" style={{ margin: "0 0 8px" }}>
          Drafted grievance · ready to paste
        </div>
        {draft ? (
          <>
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
          </>
        ) : (
          <p className="pump-meta" style={{ margin: 0 }}>
            No reports for this pump yet — file one first; the draft is built
            from your report&apos;s evidence.
          </p>
        )}
      </div>

      <div className="section-label" style={{ margin: 0 }}>
        Where to file
      </div>
      <a
        className="panel channel primary"
        href={cpgrams.url}
        target="_blank"
        rel="noreferrer"
      >
        <strong>{cpgrams.label}</strong>
        <span className="pump-meta">{cpgrams.note} →</span>
      </a>
      {omcUrl && (
        <a
          className="panel channel"
          href={omcUrl}
          target="_blank"
          rel="noreferrer"
        >
          <strong>{pump.omc} customer portal</strong>
          <span className="pump-meta">{omcPortal.note} →</span>
        </a>
      )}

      <div className="panel">
        <div className="section-label" style={{ margin: "0 0 8px" }}>
          After you file
        </div>
        {tracked ? (
          <p className="pump-meta" style={{ margin: 0 }}>
            Tracking <strong>{tracked}</strong> — we&apos;ll surface a reminder
            at the 30-day CPGRAMS resolution target, along with the DPG
            escalation path.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="field"
              placeholder="Paste CPGRAMS registration no."
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-primary"
              disabled={refNo.trim().length < 4}
              onClick={() => setTracked(refNo.trim())}
            >
              Track
            </button>
          </div>
        )}
      </div>

      <div className="cta-note" style={{ marginTop: 0 }}>
        <strong>Know your rights:</strong> every customer can ask for the
        5-litre measure check and the filter-paper density test at the pump,
        free of charge. Refusal is itself reportable.
      </div>
    </div>
  );
}
