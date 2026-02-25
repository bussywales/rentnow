import { type MobileQuickSearchCategory } from "@/lib/home/mobile-quicksearch-presets";
import { buildPropertiesCategoryParams } from "@/lib/properties/browse-categories";
import {
  DISCOVERY_CATALOGUE,
  selectDiscoveryItems,
  validateDiscoveryCatalogue,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";

export type MobileFeaturedDiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  category: MobileQuickSearchCategory;
  city?: string;
  shortletParams?: Record<string, string>;
  tag: string;
};

type FeaturedSelectionInput = {
  marketCountry?: string | null;
  now?: Date;
  limit?: number;
  seedBucket?: string | null;
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
};

const CATEGORY_TAGS: Record<MobileQuickSearchCategory, string> = {
  rent: "To rent",
  buy: "For sale",
  shortlet: "Shortlets",
  off_plan: "Off-plan",
  all: "All homes",
};

function resolveCategoryFromItem(item: DiscoveryCatalogueItem): MobileQuickSearchCategory {
  if (item.kind === "shortlet" || item.intent === "shortlet") return "shortlet";
  const explicitCategory = (item.params.category ?? "").trim().toLowerCase();
  if (explicitCategory === "shortlet") return "shortlet";
  if (explicitCategory === "off_plan" || explicitCategory === "off-plan") return "off_plan";
  if (explicitCategory === "buy" || explicitCategory === "sale") return "buy";
  if (explicitCategory === "all") return "all";
  if (item.intent === "buy") return "buy";
  return "rent";
}

function toMobileFeaturedItem(item: DiscoveryCatalogueItem): MobileFeaturedDiscoveryItem {
  const category = resolveCategoryFromItem(item);
  const city = (item.params.city ?? item.params.where ?? "").trim() || undefined;
  const shortletParams =
    category === "shortlet"
      ? Object.fromEntries(
          Object.entries(item.params).filter(([key]) => key !== "city" && key !== "where")
        )
      : undefined;

  return {
    id: item.id,
    title: item.title,
    subtitle: (item.subtitle ?? "").trim() || "Explore curated options for this market.",
    category,
    city,
    shortletParams,
    tag: CATEGORY_TAGS[category],
  };
}

export function validateMobileFeaturedDiscoveryCatalogue(input: {
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
  now?: Date;
}): { items: DiscoveryCatalogueItem[]; warnings: string[] } {
  return validateDiscoveryCatalogue({
    items: input.items ?? DISCOVERY_CATALOGUE,
    now: input.now,
  });
}

export function getMobileFeaturedDiscoveryItems(input: FeaturedSelectionInput = {}): MobileFeaturedDiscoveryItem[] {
  const selected = selectDiscoveryItems({
    market: input.marketCountry ?? null,
    surface: "HOME_FEATURED",
    limit: Math.max(1, input.limit ?? 6),
    seedDate: input.now,
    seedBucket: input.seedBucket ?? "public-mobile",
    items: input.items ?? DISCOVERY_CATALOGUE,
  });
  return selected.map(toMobileFeaturedItem);
}

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
