"use client";

import dynamic from "next/dynamic";
import type { PumpWithScore } from "@/lib/data";

// Leaflet touches `window` at import time — client-only.
const PumpMap = dynamic(() => import("./PumpMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "clamp(280px, 45vh, 420px)",
        display: "grid",
        placeItems: "center",
      }}
    >
      Loading map…
    </div>
  ),
});

export default function PumpMapLoader({ pumps }: { pumps: PumpWithScore[] }) {
  return <PumpMap pumps={pumps} />;
}
