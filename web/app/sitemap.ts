import type { MetadataRoute } from "next";
import { getApiBaseUrl, getSiteUrl } from "@/lib/env";

type PropertySummary = { id: string; updated_at?: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (await getSiteUrl()) || "https://www.propatyhub.com";
  const apiBaseUrl = await getApiBaseUrl();
  const urls: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/properties`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/dashboard`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  try {
    const res = await fetch(`${apiBaseUrl}/api/properties`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const properties = (json.properties as PropertySummary[]) || [];
      properties.forEach((p) => {
        if (!p.id) return;
        urls.push({
          url: `${baseUrl}/properties/${encodeURIComponent(p.id)}`,
          lastModified: p.updated_at || undefined,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      });
    }
  } catch {
    // Swallow fetch errors; fallback to static URLs above.
  }

  return urls;
}
