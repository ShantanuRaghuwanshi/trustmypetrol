import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AGENCIES,
  contractorScorecards,
  contractorSlug,
  dlpEndDate,
  dlpStatusOf,
  formatInrCompact,
  ISSUE_TYPES,
  isAgencySlug,
  issueCoveredByWork,
} from "@tmp/civic";
import { getCivicIssues, getCivicWorks } from "@/lib/civicData";

export const revalidate = 300;

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [works, issues] = await Promise.all([getCivicWorks(), getCivicIssues()]);
  const card = contractorScorecards(works, issues).find((c) => c.slug === slug);
  if (!card) return {};
  return {
    title: `${card.name} — public works record`,
    description: `${card.workCount} works on record, ${card.issuesInCoverage} citizen-reported issues in their coverage, ${card.dlpLiableOpen} open inside the defect liability period. Sourced from site boards, tenders, and RTI responses.`,
  };
}

export default async function ContractorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [works, issues] = await Promise.all([getCivicWorks(), getCivicIssues()]);
  const card = contractorScorecards(works, issues).find((c) => c.slug === slug);
  if (!card) notFound();

  const theirWorks = works.filter(
    (w) => w.contractorName && contractorSlug(w.contractorName) === slug,
  );

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">Contractor · public works record</div>
          <h1>{card.name}</h1>
          <div className="pump-meta">
            {card.workCount} {card.workCount === 1 ? "work" : "works"} on
            record
            {card.knownCostInr && ` · ${formatInrCompact(card.knownCostInr)} in known contract value`}
            {card.agencySlugs.length > 0 &&
              ` · awarded by ${card.agencySlugs
                .map((a) => (isAgencySlug(a) ? AGENCIES[a].name : a))
                .join(", ")}`}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="section-label" style={{ margin: "0 0 8px" }}>
          The record
        </div>
        <p style={{ margin: 0, lineHeight: 1.9 }}>
          <strong>{card.issuesInCoverage}</strong> citizen-reported{" "}
          {card.issuesInCoverage === 1 ? "issue" : "issues"} within their works
          · <strong>{card.openIssues}</strong> unresolved
          {card.dlpLiableOpen > 0 && (
            <>
              {" "}
              · <strong>{card.dlpLiableOpen}</strong> open inside a live
              defect liability period — contractually the contractor&apos;s
              repair
            </>
          )}
          {card.reopenedIssues > 0 && (
            <>
              {" "}
              · <strong>{card.reopenedIssues}</strong> reopened after a
              claimed fix
            </>
          )}
          {card.safetyCriticalOpen > 0 && (
            <>
              {" "}
              · <strong>{card.safetyCriticalOpen}</strong> open safety hazard
              {card.safetyCriticalOpen === 1 ? "" : "s"} ⚠️
            </>
          )}
        </p>
      </div>

      <div className="section-label">Works on record</div>
      {theirWorks.map((w) => {
        const covered = issues.filter((i) => issueCoveredByWork(i, w));
        const dlp = dlpStatusOf(w);
        return (
          <div key={w.id} className="panel" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{w.title}</p>
            <p className="pump-meta" style={{ margin: "4px 0 0" }}>
              {isAgencySlug(w.agencySlug ?? "") &&
                `${AGENCIES[w.agencySlug as keyof typeof AGENCIES].name} · `}
              {w.costInr && `${formatInrCompact(w.costInr)} · `}
              {w.completionDate && `completed ${dateIN(w.completionDate)} · `}
              {dlp === "inside"
                ? `DLP runs until ${dateIN(dlpEndDate(w)!.toISOString())}`
                : dlp === "expired"
                  ? `DLP ended ${dateIN(dlpEndDate(w)!.toISOString())}`
                  : "DLP not on record"}
              {" · "}source: {w.source.replace("_", " ")}
              {w.sourceUrl && (
                <>
                  {" "}
                  (
                  <a href={w.sourceUrl} target="_blank" rel="noreferrer">
                    record
                  </a>
                  )
                </>
              )}
            </p>
            {covered.length > 0 && (
              <p className="pump-meta" style={{ margin: "6px 0 0" }}>
                Issues in coverage:{" "}
                {covered.slice(0, 8).map((i, idx) => (
                  <span key={i.id}>
                    {idx > 0 && " · "}
                    <Link href={`/civic/issue/${i.id}`}>
                      {ISSUE_TYPES[i.issueType].label.toLowerCase()} (
                      {i.status.replace("_", " ")})
                    </Link>
                  </span>
                ))}
                {covered.length > 8 && ` · +${covered.length - 8} more`}
              </p>
            )}
          </div>
        );
      })}

      <p className="pump-meta" style={{ marginTop: 18 }}>
        This page shows verifiable records only: works from sourced documents
        (site boards, tender awards, RTI responses) and geo-verified citizen
        reports matched by location. Issue proximity to a work does not by
        itself establish the cause of a defect; defect liability terms are as
        per the contract on record.
      </p>
    </>
  );
}
