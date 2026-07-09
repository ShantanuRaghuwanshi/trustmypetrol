"use client";

import dynamic from "next/dynamic";
import type { PumpWithScore } from "@/lib/data";
import type { UserLoc } from "./PumpMap";

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

export default function PumpMapLoader({
  pumps,
  userLoc,
  nearMe,
}: {
  pumps: PumpWithScore[];
  userLoc?: UserLoc | null;
  nearMe?: boolean;
}) {
  return <PumpMap pumps={pumps} userLoc={userLoc} nearMe={nearMe} />;
}
