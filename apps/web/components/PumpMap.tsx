"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { distanceMeters, formatDistance } from "@tmp/shared";
import type { PumpWithScore } from "@/lib/data";

export interface UserLoc {
  lat: number;
  lng: number;
}

const VERDICT_COLORS: Record<string, string> = {
  good: "#2e8b57",
  mixed: "#d97e2b",
  poor: "#c0442e",
};

function pinFor(pump: PumpWithScore): L.DivIcon {
  const color =
    pump.score.verdict === null
      ? "#9db0ae"
      : VERDICT_COLORS[pump.score.verdict]!;
  const label = pump.score.score === null ? "·" : String(pump.score.score);
  return L.divIcon({
    className: "",
    html: `<div class="pin-marker" style="background:${color}">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Rendering thousands of DOM markers makes Leaflet crawl; prioritise
// scored pumps and cap the rest until clustering lands.
const MAX_MARKERS = 400;

const USER_ICON = () =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.25)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

export default function PumpMap({
  pumps: allPumps,
  userLoc,
  nearMe,
}: {
  pumps: PumpWithScore[];
  userLoc?: UserLoc | null;
  nearMe?: boolean;
}) {
  const dist = (p: PumpWithScore) =>
    userLoc ? distanceMeters(userLoc.lat, userLoc.lng, p.lat, p.lng) : 0;
  const focusNear = Boolean(nearMe && userLoc);
  const pumps =
    allPumps.length <= MAX_MARKERS
      ? allPumps
      : [...allPumps]
          .sort((a, b) =>
            focusNear
              ? dist(a) - dist(b)
              : (b.score.reportCount ?? 0) - (a.score.reportCount ?? 0),
          )
          .slice(0, MAX_MARKERS);
  // Fit whatever set of pumps we're given — one city zooms in, all-India
  // zooms out. With "near me" on, frame the user and the closest pumps
  // instead. Remounted (via key) when city or near-me changes.
  let bounds: [[number, number], [number, number]];
  if (focusNear && userLoc) {
    const nearest = [...pumps].sort((a, b) => dist(a) - dist(b)).slice(0, 12);
    const lats = [userLoc.lat, ...nearest.map((p) => p.lat)];
    const lngs = [userLoc.lng, ...nearest.map((p) => p.lng)];
    bounds = [
      [Math.min(...lats) - 0.005, Math.min(...lngs) - 0.005],
      [Math.max(...lats) + 0.005, Math.max(...lngs) + 0.005],
    ];
  } else {
    bounds = pumps.length
      ? [
          [
            Math.min(...pumps.map((p) => p.lat)) - 0.02,
            Math.min(...pumps.map((p) => p.lng)) - 0.02,
          ],
          [
            Math.max(...pumps.map((p) => p.lat)) + 0.02,
            Math.max(...pumps.map((p) => p.lng)) + 0.02,
          ],
        ]
      : [
          [8, 68],
          [34, 90],
        ];
  }

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [24, 24] }}
      style={{ height: "clamp(280px, 45vh, 420px)", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLoc && (
        <Marker
          position={[userLoc.lat, userLoc.lng]}
          icon={USER_ICON()}
          zIndexOffset={1000}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}
      {pumps.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinFor(p)}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.omc} · {p.address}
            {userLoc && (
              <>
                <br />
                {formatDistance(dist(p))} away
              </>
            )}
            <br />
            <a href={`/pump/${p.id}`}>View record →</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
