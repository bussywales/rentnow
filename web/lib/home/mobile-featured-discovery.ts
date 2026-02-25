import { type MobileQuickSearchCategory } from "@/lib/home/mobile-quicksearch-presets";
import { buildPropertiesCategoryParams } from "@/lib/properties/browse-categories";

export type MobileFeaturedDiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  category: MobileQuickSearchCategory;
  city?: string;
  shortletParams?: Record<string, string>;
  tag: string;
};

export const MOBILE_FEATURED_DISCOVERY_ITEMS: MobileFeaturedDiscoveryItem[] = [
  {
    id: "shortlet-lagos-weekend",
    title: "Weekend shortlets in Lagos",
    subtitle: "Curated stays for fast city breaks.",
    category: "shortlet",
    city: "Lagos",
    shortletParams: { guests: "2", sort: "recommended" },
    tag: "Shortlets",
  },
  {
    id: "rent-abuja-family",
    title: "Family rentals in Abuja",
    subtitle: "Space-first homes in central districts.",
    category: "rent",
    city: "Abuja",
    tag: "To rent",
  },
  {
    id: "buy-lagos-verified",
    title: "Buy verified homes in Lagos",
    subtitle: "Ready-to-view listings with clear status.",
    category: "buy",
    city: "Lagos",
    tag: "For sale",
  },
  {
    id: "offplan-lagos-growth",
    title: "Off-plan picks in Lagos",
    subtitle: "Projects with long-horizon upside.",
    category: "off_plan",
    city: "Lagos",
    tag: "Off-plan",
  },
  {
    id: "all-nigeria-discovery",
    title: "All homes across Nigeria",
    subtitle: "Broad discovery when you are still deciding.",
    category: "all",
    tag: "All homes",
  },
  {
    id: "shortlet-abuja-business",
    title: "Business stays in Abuja",
    subtitle: "Quiet, central stays for short trips.",
    category: "shortlet",
    city: "Abuja",
    shortletParams: { guests: "1", sort: "recommended" },
    tag: "Shortlets",
  },
];

export function buildMobileQuickSearchHref(input: {
  category: MobileQuickSearchCategory;
  city?: string | null;
  shortletParams?: Record<string, string> | null;
}): string {
  if (input.category === "shortlet") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input.shortletParams ?? {})) {
      const trimmedValue = value?.trim();
      if (trimmedValue) {
        params.set(key, trimmedValue);
      }
    }
    const city = input.city?.trim();
    if (city) {
      params.set("where", city);
    } else if (!params.get("where")) {
      params.delete("where");
    }
    params.delete("city");
    if (!params.get("guests")) {
      params.set("guests", "1");
    }
    const shortletQuery = params.toString();
    return shortletQuery ? `/shortlets?${shortletQuery}` : "/shortlets";
  }

  const params = buildPropertiesCategoryParams(new URLSearchParams(), input.category);
  const city = input.city?.trim();
  if (city) {
    params.set("city", city);
  } else {
    params.delete("city");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}

export function buildFeaturedDiscoveryHref(item: MobileFeaturedDiscoveryItem): string {
  return buildMobileQuickSearchHref({
    category: item.category,
    city: item.city,
    shortletParams: item.shortletParams ?? null,
  });
}
