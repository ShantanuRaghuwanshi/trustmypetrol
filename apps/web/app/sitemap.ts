import type { MetadataRoute } from "next";
import { getPumpsWithScores } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pumps = await getPumpsWithScores();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/rights`, changeFrequency: "monthly", priority: 0.6 },
    ...pumps.map((p) => ({
      url: `${SITE_URL}/pump/${p.id}`,
      changeFrequency: "daily" as const,
      // pumps with community evidence are the pages worth crawling first
      priority: p.score.reportCount > 0 ? 0.8 : 0.5,
    })),
  ];
}
