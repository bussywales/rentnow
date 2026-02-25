import {
  selectDiscoveryItems,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";
import {
  buildPropertiesCategoryParams,
  type PropertiesBrowseCategory,
} from "@/lib/properties/browse-categories";

const ALLOWED_PROPERTIES_QUERY_KEYS = [
  "city",
  "q",
  "minPrice",
  "maxPrice",
  "bedrooms",
  "propertyType",
  "furnished",
  "sort",
  "recent",
] as const;

const CATEGORY_TAGS: Record<PropertiesBrowseCategory, string> = {
  rent: "To rent",
  buy: "For sale",
  shortlet: "Short-lets",
  off_plan: "Off-plan",
  all: "All homes",
};

export type PropertiesFeaturedRailItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  href: string;
};

function resolveCategoryFromItem(item: DiscoveryCatalogueItem): PropertiesBrowseCategory {
  const explicitCategory = (item.params.category ?? "").trim().toLowerCase();
  if (explicitCategory === "shortlet" || explicitCategory === "short_let") return "shortlet";
  if (explicitCategory === "off_plan" || explicitCategory === "off-plan") return "off_plan";
  if (explicitCategory === "buy" || explicitCategory === "sale") return "buy";
  if (explicitCategory === "all") return "all";
  if (item.intent === "shortlet") return "shortlet";
  if (item.intent === "buy") return "buy";
  return "rent";
}

function resolveCity(item: DiscoveryCatalogueItem): string | null {
  const city = (item.params.city ?? item.params.where ?? "").trim();
  return city || null;
}

export function buildPropertiesFeaturedHref(item: DiscoveryCatalogueItem): string {
  const category = resolveCategoryFromItem(item);
  const params = buildPropertiesCategoryParams(new URLSearchParams(), category);
  for (const key of ALLOWED_PROPERTIES_QUERY_KEYS) {
    const value = item.params[key];
    const nextValue = typeof value === "string" ? value.trim() : "";
    if (!nextValue) continue;
    params.set(key, nextValue);
  }

  const city = resolveCity(item);
  if (city) {
    params.set("city", city);
  } else {
    params.delete("city");
  }

  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}

export function selectPropertiesFeaturedRailItems(input: {
  marketCountry: string;
  limit?: number;
  now?: Date;
  seedBucket?: string;
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
}): PropertiesFeaturedRailItem[] {
  const limit = Math.max(1, input.limit ?? 6);
  const selection = selectDiscoveryItems({
    market: input.marketCountry,
    surface: "PROPERTIES_FEATURED",
    limit: Math.max(limit * 2, 8),
    seedDate: input.now,
    seedBucket: input.seedBucket ?? "properties-featured-rail",
    items: input.items,
  });

  const propertyItems = selection.filter((item) => item.kind === "property");

  return propertyItems.slice(0, limit).map((item) => {
    const category = resolveCategoryFromItem(item);
    const city = resolveCity(item);
    const subtitle = (item.subtitle ?? "").trim() || "Explore homes picked for this market.";
    return {
      id: item.id,
      title: item.title,
      subtitle,
      tag: city ? `${CATEGORY_TAGS[category]}: ${city}` : CATEGORY_TAGS[category],
      href: buildPropertiesFeaturedHref(item),
    };
  });
}
