import type { Metadata } from "next";
import { getPumpsWithScores } from "@/lib/data";
import PumpExplorer from "@/components/PumpExplorer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Petrol pump trust scores — check before you fill up",
  description:
    "Trust scores for 2,300+ petrol pumps across Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, and Ahmedabad — built from geo-verified, photo-backed reports by riders and drivers, not by the oil companies.",
};

export default async function PumpsPage() {
  const pumps = await getPumpsWithScores();

  return (
    <>
      <section className="hero">
        <h1>Check the pump before you fill up</h1>
        <p>
          Trust scores built from geo-verified, photo-backed reports by riders
          and drivers — not by the oil companies. Short-fuelling, adulteration
          signals, blend labelling, and refused density checks, on the record
          per pump. Covering Delhi, Mumbai, Bengaluru, Hyderabad, Chennai,
          Kolkata, Pune, and Ahmedabad.
        </p>
      </section>
      <PumpExplorer pumps={pumps} />
    </>
  );
}
