import Link from "next/link";
import { getPumpsWithScores } from "@/lib/data";
import { getCivicIssues } from "@/lib/civicData";
import { SITE_URL } from "@/lib/site";

export const revalidate = 300;

/**
 * The landing page's one job: a first-time visitor understands what JanSetu
 * is, how the loop works, and where to go — in one screen. Everything is
 * plain language; the FAQ carries the same answers as FAQPage structured
 * data for search engines.
 */

const STEPS = [
  {
    title: "Report it, live",
    body: "Photo taken in-app with GPS at the spot — a pothole, a choked drain, a pump that short-fuels. No gallery uploads, so every report is evidence.",
  },
  {
    title: "It goes to the right desk",
    body: "Reports are routed automatically: municipal corporation inside city limits, state PWD outside, NHAI on highways, oil-company portals for pumps.",
  },
  {
    title: "Escalate when nothing moves",
    body: "We draft the formal complaint, you file it, and a 30-day timer starts. When it lapses, escalate one tap up the ladder — all the way to CPGRAMS.",
  },
  {
    title: "It stays on the record",
    body: "Issues, fixes, reopened defects, contractors, and defect-liability periods build a permanent public ledger nobody can quietly close.",
  },
];

const FAQ = [
  {
    q: "What is JanSetu?",
    a: "JanSetu (जनसेतु, \"people's bridge\") is a citizen accountability platform for India. It puts petrol-pump quality and civic infrastructure problems — potholes, drainage, streetlights — on one public map, routes reports to the agency responsible, helps you file and escalate formal grievances, and keeps a permanent record of what got fixed, what didn't, and who was accountable.",
  },
  {
    q: "How are reports verified?",
    a: "Photos are taken live inside the app with GPS, accuracy, and timestamp recorded at the moment of capture. Reports that fail these checks still count, but with lower weight and a visible 'unverified' label. Resolution is community-verified too: an issue only closes after independent reporters confirm the fix on the spot.",
  },
  {
    q: "Where do complaints actually go?",
    a: "JanSetu prepares everything and you press the button — drafts are pasted into the official channel for the asset: municipal portals like PMC or MCD311, state portals like Aaple Sarkar, NHAI's Rajmargyatra, oil-company portals for pumps, and CPGRAMS (pgportal.gov.in) as the universal backstop with its 30-day statutory window.",
  },
  {
    q: "What is the contractor / defect-liability record?",
    a: "Road and drainage contracts carry a defect liability period (DLP) during which repairs are the contractor's cost, not fresh public money. JanSetu matches issues to the works contract covering that location — sourced from photographed site boards, tender awards, RTI responses — and shows whether the DLP is still running.",
  },
  {
    q: "Is JanSetu a government app?",
    a: "No. JanSetu is independent and neutral — not affiliated with any oil company, municipal body, or contractor. It shows only verifiable records: sourced documents and geo-verified citizen reports. Filing always happens on the official government portals, by you.",
  },
];

export default async function HomePage() {
  const [pumps, issues] = await Promise.all([
    getPumpsWithScores(),
    getCivicIssues(),
  ]);
  const openIssues = issues.filter((i) => i.status !== "resolved").length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "JanSetu",
        alternateName: "जनसेतु",
        url: SITE_URL,
        description:
          "Citizen accountability for India: petrol pump trust scores and civic infrastructure issues on one map — geo-verified reports, agency routing, grievance escalation, RTI and contractor records.",
        inLanguage: "en-IN",
      },
      {
        "@type": "Organization",
        name: "JanSetu",
        url: SITE_URL,
        slogan: "आपका शहर, रिकॉर्ड पर — your city, on the record",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── What this is ─────────────────────────────────────────────── */}
      <section className="hero">
        <h1>Your city, on the record</h1>
        <p>
          JanSetu (जनसेतु) is a citizen&apos;s bridge to the bodies that answer
          for your city. Report a pothole, a choked drain, or a petrol pump
          that short-fuels — with live photo and GPS — and JanSetu routes it
          to the agency responsible, helps you escalate formally when nothing
          moves, and keeps the outcome on a public record that includes the
          contractor who built it.
        </p>
        <p className="pump-meta" style={{ marginTop: 10 }}>
          {pumps.length.toLocaleString("en-IN")} petrol pumps scored
          {openIssues > 0 &&
            ` · ${openIssues.toLocaleString("en-IN")} civic issues being tracked`}{" "}
          · 8 metros: Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata,
          Pune, Ahmedabad
        </p>
      </section>

      {/* ── Two doors ────────────────────────────────────────────────── */}
      <div className="pump-grid" style={{ marginBottom: 24 }}>
        <Link href="/civic" className="pump-card">
          <div className="top">
            <h3>🚧 Civic issues</h3>
          </div>
          <div className="pump-meta">
            Potholes, drainage, waterlogging, streetlights — mapped, routed to
            the responsible agency, escalated to CPGRAMS, matched to the
            contractor on record.
          </div>
          <div className="pump-meta" style={{ marginTop: 6 }}>
            City report cards · contractor records · RTI help →
          </div>
        </Link>
        <Link href="/pumps" className="pump-card">
          <div className="top">
            <h3>⛽ Petrol pumps</h3>
          </div>
          <div className="pump-meta">
            Trust scores from geo-verified rider reports — short-fuelling,
            adulteration signals, blend labelling, refused density checks.
          </div>
          <div className="pump-meta" style={{ marginTop: 6 }}>
            Check the pump before you fill up →
          </div>
        </Link>
      </div>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <div className="section-label">How it works</div>
      <div className="pump-grid" style={{ marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s.title} className="panel">
            <div
              className="section-label"
              style={{ margin: "0 0 6px", color: "var(--petrol)" }}
            >
              Step {i + 1}
            </div>
            <p style={{ margin: 0, fontWeight: 700 }}>{s.title}</p>
            <p className="pump-meta" style={{ margin: "4px 0 0" }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <div className="cta-note" style={{ marginBottom: 24 }}>
        <strong>Reporting happens in the app</strong> — photos are taken live
        at the spot, which is what makes every report evidence. This site is
        the public record: browse it, cite it, escalate from it.
      </div>

      {/* ── FAQ (mirrors the FAQPage structured data above) ──────────── */}
      <div className="section-label">Frequently asked questions</div>
      <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
        {FAQ.map((f) => (
          <details key={f.q} className="panel">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              {f.q}
            </summary>
            <p className="pump-meta" style={{ margin: "8px 0 0" }}>
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </>
  );
}
