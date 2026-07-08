import Link from "next/link";
import { getPumpsWithScores } from "@/lib/data";
import { ScorePill } from "@/components/ScorePill";
import PumpMapLoader from "@/components/PumpMapLoader";

export const revalidate = 300;

function blendChips(p: Awaited<ReturnType<typeof getPumpsWithScores>>[number]) {
  const chips: { label: string; on: boolean }[] = [
    { label: "E20", on: p.blends.e20 },
    { label: "E10", on: p.blends.e10 },
    { label: "Premium", on: p.blends.premium },
    { label: "CNG", on: p.blends.cng },
  ];
  return chips.filter((c) => c.on);
}

export default async function HomePage() {
  const pumps = await getPumpsWithScores();
  const scored = [...pumps].sort(
    (a, b) => (b.score.score ?? -1) - (a.score.score ?? -1),
  );

  return (
    <>
      <section className="hero">
        <h1>Check the pump before you fill up</h1>
        <p>
          Trust scores built from geo-verified, photo-backed reports by riders
          and drivers — not by the oil companies. Currently piloting in Pune.
        </p>
      </section>

      <div className="map-panel">
        <PumpMapLoader pumps={pumps} />
      </div>

      <div className="section-label">
        {pumps.length} pumps · scores over the last 90 days
      </div>
      <div className="pump-grid">
        {scored.map((p) => (
          <Link key={p.id} href={`/pump/${p.id}`} className="pump-card">
            <div className="top">
              <h3>{p.name}</h3>
              <ScorePill score={p.score} />
            </div>
            <div className="pump-meta">
              {p.omc} · {p.address} · dealer {p.dealerCode}
            </div>
            <div className="chips">
              {blendChips(p).map((c) => (
                <span key={c.label} className="chip on">
                  {c.label}
                </span>
              ))}
              {p.score.reportCount > 0 && (
                <span className="chip">
                  {p.score.reportCount} reports ·{" "}
                  {Math.round(p.score.geoVerifiedRatio * 100)}% geo-verified
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
