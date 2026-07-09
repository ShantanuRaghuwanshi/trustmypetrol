"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  displayDealerCode,
  distanceMeters,
  formatDistance,
  CITY_NAMES,
} from "@tmp/shared";
import type { PumpWithScore } from "@/lib/data";
import { ScorePill } from "@/components/ScorePill";
import PumpMapLoader from "@/components/PumpMapLoader";

type Filter = "all" | "premium" | "higherBlends" | "e100" | "cng";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "premium", label: "Unblended premium (XP100)" },
  { id: "higherBlends", label: "E25+ blends" },
  { id: "e100", label: "E100" },
  { id: "cng", label: "CNG" },
];

export default function PumpExplorer({ pumps }: { pumps: PumpWithScore[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [city, setCity] = useState(""); // "" = all India
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [nearMe, setNearMe] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locDenied, setLocDenied] = useState(false);

  const locate = useCallback((silent: boolean) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setLocDenied(false);
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (!silent) setLocDenied(true);
      },
      { maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  // if the browser has already granted location, sort by distance right away
  // without prompting; otherwise wait for the "Near me" chip
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((s) => {
        if (s.state === "granted") locate(true);
      })
      .catch(() => {});
  }, [locate]);

  const distances = useMemo(() => {
    if (!userLoc) return null;
    return new Map(
      pumps.map((p) => [
        p.id,
        distanceMeters(userLoc.lat, userLoc.lng, p.lat, p.lng),
      ]),
    );
  }, [pumps, userLoc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pumps.filter((p) => {
      if (city && p.district !== city) return false;
      if (filter !== "all" && !p.blends[filter]) return false;
      if (q && !`${p.name} ${p.address} ${p.district}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [pumps, query, filter, city]);

  // scored pumps first, then named pumps over generic OSM entries; cap the
  // grid so a metro's full inventory doesn't render thousands of cards
  const GRID_CAP = 60;
  const generic = (p: PumpWithScore) =>
    /^(petrol( pump)?|fuel( station)?|petroleum|(iocl|bpcl|hpcl|shell|nayara|jio_bp) pump)$/i.test(
      p.name.trim(),
    )
      ? 1
      : 0;
  const byDistance = nearMe && distances !== null;
  const sorted = [...filtered].sort((a, b) =>
    byDistance
      ? distances.get(a.id)! - distances.get(b.id)!
      : (b.score.score ?? -1) - (a.score.score ?? -1) ||
        b.score.reportCount - a.score.reportCount ||
        generic(a) - generic(b) ||
        a.name.localeCompare(b.name),
  );
  const visible = sorted.slice(0, GRID_CAP);
  const nearest = byDistance ? sorted[0] : undefined;

  return (
    <>
      <div className="explorer-controls">
        <input
          className="field"
          placeholder={`Search pumps${city ? ` in ${city}` : ""}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          <button
            type="button"
            className={`chip-toggle${nearMe ? " on" : ""}`}
            onClick={() => {
              if (nearMe) setNearMe(false);
              else if (userLoc) setNearMe(true);
              else locate(false);
            }}
          >
            {locating ? "Locating…" : "📍 Near me"}
          </button>
          <button
            type="button"
            className={`chip-toggle${city === "" ? " on" : ""}`}
            onClick={() => setCity("")}
          >
            All India
          </button>
          {CITY_NAMES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip-toggle${city === c ? " on" : ""}`}
              onClick={() => setCity(c)}
            >
              {c}
            </button>
          ))}
        </div>
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
        <PumpMapLoader
          key={`${city || "all"}-${byDistance ? "near" : "score"}`}
          pumps={filtered}
          userLoc={userLoc}
          nearMe={byDistance}
        />
      </div>

      {locDenied && (
        <div className="section-label">
          Location unavailable — allow location access in your browser to sort
          pumps by distance.
        </div>
      )}
      <div className="section-label">
        {nearest && distances
          ? `Nearest: ${nearest.name} · ${formatDistance(distances.get(nearest.id)!)} away · `
          : ""}
        {filtered.length} pumps ·{" "}
        {byDistance ? "sorted by distance" : "scores over the last 90 days"}
        {filtered.length > visible.length &&
          ` · showing ${visible.length} — search or filter to narrow`}
      </div>
      <div className="pump-grid">
        {visible.map((p) => (
          <Link key={p.id} href={`/pump/${p.id}`} className="pump-card">
            <div className="top">
              <h3>{p.name}</h3>
              <ScorePill score={p.score} />
            </div>
            <div className="pump-meta">
              {distances?.has(p.id) &&
                `${formatDistance(distances.get(p.id)!)} away · `}
              {p.omc} · {p.address}
              {displayDealerCode(p.dealerCode) && ` · dealer ${displayDealerCode(p.dealerCode)}`}
            </div>
            <div className="chips">
              {p.blends.premium && <span className="chip on">XP100</span>}
              {p.blends.higherBlends && <span className="chip on">E25+</span>}
              {p.blends.e100 && <span className="chip on">E100</span>}
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
