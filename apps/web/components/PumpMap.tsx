"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PumpWithScore } from "@/lib/data";

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

export default function PumpMap({ pumps: allPumps }: { pumps: PumpWithScore[] }) {
  const pumps =
    allPumps.length <= MAX_MARKERS
      ? allPumps
      : [...allPumps]
          .sort(
            (a, b) =>
              (b.score.reportCount ?? 0) - (a.score.reportCount ?? 0),
          )
          .slice(0, MAX_MARKERS);
  // Fit whatever set of pumps we're given — one city zooms in, all-India
  // zooms out. Remounted (via key) when the city selection changes.
  const bounds: [[number, number], [number, number]] = pumps.length
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
      {pumps.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinFor(p)}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.omc} · {p.address}
            <br />
            <a href={`/pump/${p.id}`}>View record →</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
