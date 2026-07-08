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

export default function PumpMap({ pumps }: { pumps: PumpWithScore[] }) {
  const center: [number, number] = pumps.length
    ? [
        pumps.reduce((s, p) => s + p.lat, 0) / pumps.length,
        pumps.reduce((s, p) => s + p.lng, 0) / pumps.length,
      ]
    : [18.5204, 73.8567];

  return (
    <MapContainer
      center={center}
      zoom={12}
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
