"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PumpWithScore } from "@/lib/data";
import { ScorePill } from "@/components/ScorePill";
import PumpMapLoader from "@/components/PumpMapLoader";

type Filter = "all" | "e10" | "premium" | "cng";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "e10", label: "E10 available" },
  { id: "premium", label: "Premium (non-E20)" },
  { id: "cng", label: "CNG" },
];

export default function PumpExplorer({ pumps }: { pumps: PumpWithScore[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pumps.filter((p) => {
      if (filter !== "all" && !p.blends[filter]) return false;
      if (q && !`${p.name} ${p.address} ${p.district}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [pumps, query, filter]);

  const sorted = [...filtered].sort(
    (a, b) => (b.score.score ?? -1) - (a.score.score ?? -1),
  );

  return (
    <>
      <div className="explorer-controls">
        <input
          className="field"
          placeholder="Search pumps in Pune…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip-toggle${filter === f.id ? " on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="map-panel">
        <PumpMapLoader pumps={filtered} />
      </div>

      <div className="section-label">
        {filtered.length} pumps · scores over the last 90 days
      </div>
      <div className="pump-grid">
        {sorted.map((p) => (
          <Link key={p.id} href={`/pump/${p.id}`} className="pump-card">
            <div className="top">
              <h3>{p.name}</h3>
              <ScorePill score={p.score} />
            </div>
            <div className="pump-meta">
              {p.omc} · {p.address} · dealer {p.dealerCode}
            </div>
            <div className="chips">
              {p.blends.e20 && <span className="chip on">E20</span>}
              {p.blends.e10 && <span className="chip on">E10</span>}
              {p.blends.premium && <span className="chip on">Premium</span>}
              {p.blends.cng && <span className="chip on">CNG</span>}
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
