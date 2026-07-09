/**
 * Canonical site origin for absolute URLs (sitemap, Open Graph, JSON-LD).
 * Set NEXT_PUBLIC_SITE_URL in production; falls back to the Vercel preview
 * URL, then localhost for dev.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");
