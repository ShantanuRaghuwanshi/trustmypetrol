import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, type CityName } from "@tmp/shared";
import {
  AGENCIES,
  ALL_AGENCY_SLUGS,
  cityStats,
  ISSUE_CATEGORIES,
  ISSUE_TYPES,
  MIN_ISSUES_FOR_RATES,
  type CivicAgency,
  type IssueCategory,
} from "@tmp/civic";
import { getCivicIssues } from "@/lib/civicData";

export const revalidate = 300;

/** /civic/pune, /civic/mumbai, … — the SEO surface for public pressure. */
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.name.toLowerCase() }));
}

function cityFromSlug(slug: string): CityName | null {
  return (
    CITIES.find((c) => c.name.toLowerCase() === slug.toLowerCase())?.name ??
    null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) return {};
  return {
    title: `${city} civic report card — potholes, drains, streetlights`,
    description: `How ${city} is doing on citizen-reported civic issues: open potholes, drainage problems, resolution times, and the longest-pending complaints — with escalation paths to the responsible agencies.`,
  };
}

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  });

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default async function CityReportCard({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) notFound();

  const issues = await getCivicIssues();
  const s = cityStats(city, issues);
  // Widen from the registry's literal types so optional fields are visible.
  const ulb: CivicAgency | undefined = ALL_AGENCY_SLUGS.map(
    (a) => AGENCIES[a] as CivicAgency,
  ).find((a) => a.kind === "ulb" && a.city === city);
  const categories = Object.keys(ISSUE_CATEGORIES) as IssueCategory[];
  const maxCategory = Math.max(
    1,
    ...categories.map((c) => s.byCategory[c].open + s.byCategory[c].resolved),
  );

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">
            Civic report card{ulb ? ` · ${ulb.name}` : ""}
          </div>
          <h1>{city}</h1>
          <div className="pump-meta">
            Citizen-reported issues within 40 km of the city centre, from
            geo-verified photo reports. Not an official statistic — this is
            the community ledger.
          </div>
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: "grid", gap: 14 }}>
          <div className="panel">
            <div className="section-label" style={{ margin: "0 0 8px" }}>
              The numbers
            </div>
            <p style={{ margin: 0, lineHeight: 1.9 }}>
              <strong>{s.open}</strong> unresolved{" "}
              {s.open === 1 ? "issue" : "issues"} ·{" "}
              <strong>{s.resolved}</strong> resolved
              {s.safetyCriticalOpen > 0 && (
                <>
                  {" "}
                  · <strong>{s.safetyCriticalOpen}</strong> open safety hazard
                  {s.safetyCriticalOpen === 1 ? "" : "s"} ⚠️
                </>
              )}
              <br />
              {s.resolutionRate !== null ? (
                <>
                  Resolution rate{" "}
                  <strong>{Math.round(s.resolutionRate * 100)}%</strong>
                </>
              ) : (
                <>
                  Fewer than {MIN_ISSUES_FOR_RATES} issues on record — rates
                  shown once there&apos;s enough data
                </>
              )}
              {s.medianResolutionDays !== null && (
                <>
                  {" "}
                  · median time to resolution{" "}
                  <strong>{Math.round(s.medianResolutionDays)} days</strong>
                </>
              )}
            </p>
          </div>

          <div className="panel">
            <div className="section-label" style={{ margin: "0 0 8px" }}>
              By category
            </div>
            {categories.map((c) => {
              const { open, resolved } = s.byCategory[c];
              const total = open + resolved;
              return (
                <div className="signal-row" key={c}>
                  <span className="name">{ISSUE_CATEGORIES[c].label}</span>
                  <div className="bar">
                    <i style={{ width: `${(total / maxCategory) * 100}%` }} />
                  </div>
                  <span className="count">
                    {open} open · {resolved} fixed
                  </span>
                </div>
              );
            })}
          </div>

          {s.waterloggingHotspots.length > 0 && (
            <div className="panel">
              <div className="section-label" style={{ margin: "0 0 8px" }}>
                Recurring waterlogging hotspots
              </div>
              {s.waterloggingHotspots.map((i) => (
                <p key={i.id} style={{ margin: "4px 0" }}>
                  <Link href={`/civic/issue/${i.id}`}>
                    {i.reportCount} reports · first {dateIN(i.firstReportedAt)}
                  </Link>
                </p>
              ))}
              <p className="pump-meta" style={{ margin: "6px 0 0" }}>
                Spots reported repeatedly — the monsoon memory the complaint
                portals don&apos;t keep.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="panel">
            <div className="section-label" style={{ margin: "0 0 8px" }}>
              Longest pending
            </div>
            {s.oldestOpen.length === 0 && (
              <p className="pump-meta" style={{ margin: 0 }}>
                Nothing unresolved on record{s.total === 0 ? " yet" : ""} —
                reports filed in the app appear here.
              </p>
            )}
            {s.oldestOpen.map((i) => (
              <p key={i.id} style={{ margin: "4px 0" }}>
                <Link href={`/civic/issue/${i.id}`}>
                  {ISSUE_TYPES[i.issueType].label}
                  {ISSUE_TYPES[i.issueType].safetyCritical ? " ⚠️" : ""}
                </Link>{" "}
                <span className="pump-meta">
                  · {daysSince(i.firstReportedAt)} days · {i.reportCount}{" "}
                  {i.reportCount === 1 ? "report" : "reports"}
                </span>
              </p>
            ))}
          </div>

          {ulb && (
            <div className="panel">
              <div className="section-label" style={{ margin: "0 0 8px" }}>
                Who answers for this
              </div>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                <strong>{ulb.name}</strong>
                <br />
                {ulb.portal?.url && (
                  <a href={ulb.portal.url} target="_blank" rel="noreferrer">
                    {ulb.portal.name} →
                  </a>
                )}
                {ulb.portal?.helpline && (
                  <span className="pump-meta">
                    {" "}
                    · helpline {ulb.portal.helpline}
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="cta-note">
            Spotted something? Report it from the app — live photo + GPS,
            routed to the right agency, escalation to CPGRAMS built in.
          </div>
        </div>
      </div>

      <p className="pump-meta" style={{ marginTop: 18 }}>
        City attribution by proximity (40 km); ward-level cards arrive with
        ward boundary data. Boundaries ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        contributors.
      </p>
    </>
  );
}
