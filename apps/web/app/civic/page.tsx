import type { Metadata } from "next";
import Link from "next/link";
import { allCityStats, contractorScorecards, formatInrCompact } from "@tmp/civic";
import { getCivicIssues, getCivicWorks, civicLive } from "@/lib/civicData";
import CivicExplorer from "@/components/CivicExplorer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Civic issues — potholes, drains, streetlights",
  description:
    "Geo-verified citizen reports of potholes, choked drains, waterlogging, and broken streetlights across 8 Indian metros — routed to the responsible agency with escalation to CPGRAMS.",
};

export default async function CivicPage() {
  const [issues, works] = await Promise.all([
    getCivicIssues(),
    getCivicWorks(),
  ]);
  // Leaderboard: cities with the most on record first — public pressure
  // rewards attention, not tidiness.
  const cities = allCityStats(issues).sort((a, b) => b.total - a.total);
  const contractors = contractorScorecards(works, issues).slice(0, 6);

  return (
    <>
      <section className="hero">
        <h1>Civic issues, on the record</h1>
        <p>
          Potholes, choked drains, dead streetlights — reported live with
          photo and GPS, clustered on the map, and routed to the agency that
          owns the asset: municipal corporation, state PWD, or NHAI. When
          nothing moves, the escalation ladder ends at CPGRAMS.
        </p>
      </section>
      {!civicLive && (
        <p className="cta-note">
          Live data is not configured in this environment. Reports filed from
          the app will appear here.
        </p>
      )}

      <div className="section-label">City report cards</div>
      <div className="pump-grid" style={{ marginBottom: 18 }}>
        {cities.map((s) => (
          <Link
            key={s.city}
            href={`/civic/${s.city.toLowerCase()}`}
            className="pump-card"
          >
            <div className="top">
              <h3>{s.city}</h3>
              {s.safetyCriticalOpen > 0 && (
                <span className="badge-unv">
                  {s.safetyCriticalOpen} hazard
                  {s.safetyCriticalOpen === 1 ? "" : "s"} ⚠️
                </span>
              )}
            </div>
            <div className="pump-meta">
              {s.open} open · {s.resolved} resolved
              {s.resolutionRate !== null &&
                ` · ${Math.round(s.resolutionRate * 100)}% resolution`}
            </div>
            <div className="pump-meta">
              {s.medianResolutionDays !== null
                ? `median fix time ${Math.round(s.medianResolutionDays)} days`
                : "report card →"}
            </div>
          </Link>
        ))}
      </div>

      {contractors.length > 0 && (
        <>
          <div className="section-label">Contractor records</div>
          <div className="pump-grid" style={{ marginBottom: 18 }}>
            {contractors.map((c) => (
              <Link
                key={c.slug}
                href={`/civic/contractor/${c.slug}`}
                className="pump-card"
              >
                <div className="top">
                  <h3>{c.name}</h3>
                  {c.dlpLiableOpen > 0 && (
                    <span className="badge-unv">
                      {c.dlpLiableOpen} in DLP
                    </span>
                  )}
                </div>
                <div className="pump-meta">
                  {c.workCount} {c.workCount === 1 ? "work" : "works"}
                  {c.knownCostInr && ` · ${formatInrCompact(c.knownCostInr)}`}
                </div>
                <div className="pump-meta">
                  {c.issuesInCoverage} issues in coverage · {c.openIssues}{" "}
                  open
                  {c.reopenedIssues > 0 && ` · ${c.reopenedIssues} reopened`}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-label">All issues</div>
      <CivicExplorer issues={issues} />
      <p className="pump-meta" style={{ marginTop: 18 }}>
        Jurisdiction boundaries ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        contributors. Reports use a fixed vocabulary of observable conditions
        — counts, not accusations.
      </p>
    </>
  );
}
