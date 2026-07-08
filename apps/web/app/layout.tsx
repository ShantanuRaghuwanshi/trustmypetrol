import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TrustMyPetrol — fuel quality, crowd-verified",
    template: "%s · TrustMyPetrol",
  },
  description:
    "Geo-verified, photo-backed fuel quality reports for petrol pumps across India. Check a pump's record before you fill up.",
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
      </body>
    </html>
  );
}
