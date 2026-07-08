import { getPumpsWithScores } from "@/lib/data";
import PumpExplorer from "@/components/PumpExplorer";

export const revalidate = 300;

export default async function HomePage() {
  const pumps = await getPumpsWithScores();

  return (
    <>
      <section className="hero">
        <h1>Check the pump before you fill up</h1>
        <p>
          Trust scores built from geo-verified, photo-backed reports by riders
          and drivers — not by the oil companies. Now covering Delhi, Mumbai,
          Bengaluru, Hyderabad, Chennai, Kolkata, Pune, and Ahmedabad.
        </p>
      </section>
      <PumpExplorer pumps={pumps} />
    </>
  );
}
