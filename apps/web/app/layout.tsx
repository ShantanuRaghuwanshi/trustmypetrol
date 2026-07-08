import type { Metadata } from "next";
import Link from "next/link";
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
            <span className="tagline">
              Fuel quality, crowd-verified · Pune pilot
            </span>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
