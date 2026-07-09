import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import AuthButton from "@/components/AuthButton";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TrustMyPetrol — fuel quality, crowd-verified",
    template: "%s · TrustMyPetrol",
  },
  description:
    "Geo-verified, photo-backed fuel quality reports for petrol pumps across India. Check a pump's record before you fill up.",
  openGraph: {
    type: "website",
    siteName: "TrustMyPetrol",
    title: "TrustMyPetrol — fuel quality, crowd-verified",
    description:
      "Geo-verified fuel quality reports for 2,300+ petrol pumps across 8 Indian metros. Check a pump's record before you fill up.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "TrustMyPetrol — fuel quality, crowd-verified",
    description:
      "Geo-verified fuel quality reports for 2,300+ petrol pumps across 8 Indian metros.",
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
              ⛽ TrustMyPetrol
            </Link>
            <nav className="site-nav">
              <Link href="/">Pumps</Link>
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
