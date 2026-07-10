import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AGENCIES,
  contractorSlug,
  dlpEndDate,
  dlpStatusOf,
  formatInrCompact,
  ISSUE_TYPES,
  isAgencySlug,
} from "@tmp/civic";
import { getCivicIssue, getIssueReports, getWorksNear } from "@/lib/civicData";
import CivicComplaintAssistant from "@/components/CivicComplaintAssistant";
import RtiAssistant from "@/components/RtiAssistant";

export const revalidate = 300;

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const issue = await getCivicIssue(id);
  if (!issue) return {};
  const def = ISSUE_TYPES[issue.issueType];
  return {
    title: `${def.label} at ${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)} — civic issue`,
    description: `${def.label}, reported ${issue.reportCount} time(s), status ${issue.status}. Routed to the responsible agency with escalation to CPGRAMS.`,
  };
}

export default async function CivicIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const issue = await getCivicIssue(id);
  if (!issue) notFound();
  const [reports, works] = await Promise.all([
    getIssueReports(id),
    getWorksNear(issue.lat, issue.lng),
  ]);
  const work = works[0] ?? null;
  const dlp = work ? dlpStatusOf(work) : null;
  const def = ISSUE_TYPES[issue.issueType];
  const agency =
    issue.agencySlug && isAgencySlug(issue.agencySlug)
      ? AGENCIES[issue.agencySlug]
      : null;

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">
            Civic issue · {issue.status.replace("_", " ")}
            {issue.roadRef ? ` · ${issue.roadRef}` : ""}
          </div>
          <h1>
            {def.label}
            {def.safetyCritical ? " ⚠️" : ""}
          </h1>
          <div className="pump-meta">
            {issue.reportCount}{" "}
            {issue.reportCount === 1 ? "report" : "reports"} · first{" "}
            {dateIN(issue.firstReportedAt)} · last{" "}
            {dateIN(issue.lastReportedAt)} ·{" "}
            <a
              href={`https://www.google.com/maps?q=${issue.lat},${issue.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}
            </a>
          </div>
          <div className="pump-meta">
            {agency
              ? `Responsible agency: ${agency.name}`
              : "Agency unresolved — CPGRAMS routes internally"}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="section-label">Reports</div>
          {reports.length === 0 && (
            <p className="pump-meta">
              Reports attached to this issue appear here.
            </p>
          )}
          {reports.map((r) => (
            <div key={r.id} className="report-card">
              <div className="head">
                <span
                  className={
                    r.verification === "geo_verified"
                      ? "badge-geo"
                      : "badge-unv"
                  }
                >
                  {r.verification === "geo_verified"
                    ? `geo-verified · ±${Math.round(r.accuracyM)} m`
                    : r.verification.replace("_", " ")}
                </span>
                <span className="who">{dateIN(r.reportedAt)}</span>
              </div>
              <p>
                {r.severity ? `Severity: ${r.severity}. ` : ""}
                {r.description ?? def.hint}
              </p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            Accountability
          </div>
          <div className="panel">
            <div className="section-label" style={{ margin: "0 0 8px" }}>
              Who built this — works registry
            </div>
            {work ? (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>{work.title}</p>
                <p className="pump-meta" style={{ margin: "4px 0 0" }}>
                  {work.contractorName ? (
                    <Link
                      href={`/civic/contractor/${contractorSlug(work.contractorName)}`}
                    >
                      {work.contractorName}
                    </Link>
                  ) : (
                    "Contractor not on record"
                  )}
                  {work.costInr && ` · ${formatInrCompact(work.costInr)}`}
                  {work.completionDate &&
                    ` · completed ${dateIN(work.completionDate)}`}
                  {work.workOrderNo && ` · WO ${work.workOrderNo}`}
                </p>
                {dlp === "inside" ? (
                  <p
                    className="cta-note"
                    style={{ marginTop: 10, marginBottom: 0 }}
                  >
                    <strong>Inside the defect liability period</strong> (until{" "}
                    {dateIN(dlpEndDate(work)!.toISOString())}) — under the
                    contract&apos;s defect liability clause, this repair is the
                    contractor&apos;s cost, not fresh public money.
                  </p>
                ) : dlp === "expired" ? (
                  <p className="pump-meta" style={{ margin: "6px 0 0" }}>
                    Defect liability period ended{" "}
                    {dateIN(dlpEndDate(work)!.toISOString())}.
                  </p>
                ) : (
                  <p className="pump-meta" style={{ margin: "6px 0 0" }}>
                    DLP dates not on record — the RTI below asks for exactly
                    that.
                  </p>
                )}
                <p className="pump-meta" style={{ margin: "6px 0 0" }}>
                  Source: {work.source.replace("_", " ")}
                  {work.verified ? " · cross-verified" : " · single source"}
                </p>
              </>
            ) : (
              <p className="pump-meta" style={{ margin: 0 }}>
                No works contract on record for this spot yet. Registry
                entries come from photographed site boards, RTI responses, and
                tender records — snap a project board from the app to add one.
              </p>
            )}
          </div>
          <RtiAssistant issue={issue} work={work} />

          <div className="section-label" style={{ marginBottom: 0 }}>
            File &amp; track
          </div>
          <CivicComplaintAssistant issue={issue} />
        </div>
      </div>
    </>
  );
}
