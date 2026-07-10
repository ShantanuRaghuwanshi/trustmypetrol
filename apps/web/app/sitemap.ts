import type { MetadataRoute } from "next";
import { CITIES } from "@tmp/shared";
import { contractorScorecards } from "@tmp/civic";
import { getCivicIssues, getCivicWorks } from "@/lib/civicData";
import { getPumpsWithScores } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pumps, issues, works] = await Promise.all([
    getPumpsWithScores(),
    getCivicIssues(),
    getCivicWorks(),
  ]);
  const contractors = contractorScorecards(works, issues);
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/civic`, changeFrequency: "daily", priority: 0.9 },
    ...CITIES.map((c) => ({
      url: `${SITE_URL}/civic/${c.name.toLowerCase()}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/rights`, changeFrequency: "monthly", priority: 0.6 },
    ...pumps.map((p) => ({
      url: `${SITE_URL}/pump/${p.id}`,
      changeFrequency: "daily" as const,
      // pumps with community evidence are the pages worth crawling first
      priority: p.score.reportCount > 0 ? 0.8 : 0.5,
    })),
    ...issues.map((i) => ({
      url: `${SITE_URL}/civic/issue/${i.id}`,
      changeFrequency: "daily" as const,
      // multi-report issues are the accountability pages worth crawling
      priority: i.reportCount > 1 ? 0.8 : 0.5,
    })),
    ...contractors.map((c) => ({
      url: `${SITE_URL}/civic/contractor/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: c.dlpLiableOpen > 0 ? 0.9 : 0.6,
    })),
  ];
}
