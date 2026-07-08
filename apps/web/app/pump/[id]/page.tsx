import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SIGNALS, type Signal } from "@tmp/shared";
import { getPump, getPumpsWithScores, getReports } from "@/lib/data";
import { ScoreRing } from "@/components/ScoreRing";

export const revalidate = 300;

export async function generateStaticParams() {
  const pumps = await getPumpsWithScores();
  return pumps.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pump = await getPump(id);
  if (!pump) return {};
  return {
    title: `${pump.name}, ${pump.district} — reviews & fuel quality reports`,
    description: `Crowd-verified fuel quality record for ${pump.name} (${pump.omc}, dealer ${pump.dealerCode}), ${pump.address}, ${pump.district}.`,
  };
}

const BAR_COLORS: Record<string, string> = {
  negative: "var(--bad)",
  positive: "var(--good)",
  neutral: "var(--nodata)",
};

export default async function PumpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pump = await getPump(id);
  if (!pump) notFound();

  const reports = await getReports(id);
  const counts = Object.entries(pump.score.signalCounts) as [Signal, number][];
  const maxCount = Math.max(1, ...counts.map(([, n]) => n));

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">
            {pump.omc} · dealer {pump.dealerCode} · {pump.district},{" "}
            {pump.state}
          </div>
          <h1>{pump.name}</h1>
          <div className="pump-meta">{pump.address}</div>
          <div className="chips" style={{ marginTop: 10 }}>
            {pump.blends.e20 && <span className="chip on">E20</span>}
            {pump.blends.premium && (
              <span className="chip on">Unblended premium (XP100)</span>
            )}
            {pump.blends.higherBlends && <span className="chip on">E25+</span>}
            {pump.blends.cng && <span className="chip on">CNG</span>}
            {!pump.blends.premium &&
              !pump.blends.higherBlends &&
              !pump.blends.e100 && <span className="chip">E20 only</span>}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <ScoreRing score={pump.score} />
          <div className="pump-meta" style={{ marginTop: 6 }}>
            {pump.score.reportCount} reports · last 90 days
          </div>
        </div>
      </div>

      <div className="cta-row">
        <Link href={`/report/${pump.id}`} className="btn-primary">
          Report an issue at this pump
        </Link>
        <Link href={`/complaint/${pump.id}`} className="btn-outline">
          File formal complaint
        </Link>
      </div>

      <div className="two-col">
        <section>
          <div className="section-label">Recent reports</div>
          {reports.length === 0 && (
            <div className="panel">No reports yet — be the first.</div>
          )}
          {reports.map((r) => (
            <article key={r.id} className="report-card">
              <div className="head">
                <span className="who">
                  Reporter ·{" "}
                  {new Date(r.reportedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {r.verification === "geo_verified" ? (
                  <span className="badge-geo">
                    ✓ Geo-verified
                    {r.distanceToPumpM != null &&
                      ` · ${Math.round(r.distanceToPumpM)} m`}
                  </span>
                ) : (
                  <span className="badge-unv">Unverified</span>
                )}
              </div>
              <div className="chips">
                {r.signals.map((s) => (
                  <span key={s} className="chip">
                    {SIGNALS[s].label}
                  </span>
                ))}
              </div>
              {r.freeText && <p>{r.freeText}</p>}
            </article>
          ))}
        </section>

        <aside>
          <div className="section-label">Signal breakdown</div>
          <div className="panel">
            {counts.length === 0 && (
              <span className="pump-meta">No signals recorded yet.</span>
            )}
            {counts
              .sort(([, a], [, b]) => b - a)
              .map(([signal, n]) => (
                <div key={signal} className="signal-row">
                  <span className="name">{SIGNALS[signal].label}</span>
                  <span className="bar">
                    <i
                      style={{
                        width: `${(n / maxCount) * 100}%`,
                        background: BAR_COLORS[SIGNALS[signal].polarity],
                      }}
                    />
                  </span>
                  <span className="count">{n}</span>
                </div>
              ))}
          </div>

          <div className="cta-note">
            <strong>Know your rights:</strong> every customer can ask for the
            5-litre measure check and the filter-paper density test at the
            pump, free of charge. Reports are filed from the TrustMyPetrol app
            with live, geo-tagged photos.
          </div>
        </aside>
      </div>
    </>
  );
}
