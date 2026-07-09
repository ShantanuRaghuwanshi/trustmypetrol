import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // transactional / auth flows have no search value
      disallow: ["/auth", "/report/", "/complaint/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
