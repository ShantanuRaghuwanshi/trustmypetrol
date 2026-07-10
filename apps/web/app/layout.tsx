import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import AuthButton from "@/components/AuthButton";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "JanSetu — your city, on the record",
    template: "%s · JanSetu",
  },
  description:
    "Geo-verified, photo-backed citizen reports across India — petrol pump quality, potholes, drainage, streetlights — routed to the responsible agency, escalated to CPGRAMS, and matched to the contractor on record.",
  openGraph: {
    type: "website",
    siteName: "JanSetu",
    title: "JanSetu — your city, on the record",
    description:
      "Fuel-quality trust scores for 2,300+ pumps and civic issue accountability across 8 Indian metros — geo-verified reports, agency routing, RTI and contractor records.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "JanSetu — your city, on the record",
    description:
      "Geo-verified fuel and civic accountability across 8 Indian metros.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">
              🌉 JanSetu
            </Link>
            <nav className="site-nav">
              <Link href="/">Pumps</Link>
              <Link href="/civic">Civic</Link>
              <Link href="/rights">Your rights</Link>
              <AuthButton />
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="inner">
            <span>
              8 metro cities · Scores from geo-verified reports over the last
              90 days · Pump locations ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              contributors
            </span>
            <span>
              Fuel quality issue?{" "}
              <Link href="/rights">Know your rights</Link> · escalate via{" "}
              <a
                href="https://pgportal.gov.in/"
                target="_blank"
                rel="noreferrer"
              >
                CPGRAMS
              </a>
            </span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
