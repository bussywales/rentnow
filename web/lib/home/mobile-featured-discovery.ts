import { type MobileQuickSearchCategory } from "@/lib/home/mobile-quicksearch-presets";
import { buildPropertiesCategoryParams } from "@/lib/properties/browse-categories";
import {
  MOBILE_FEATURED_DISCOVERY_CATALOGUE,
  MOBILE_FEATURED_DISCOVERY_MARKETS,
  type MobileFeaturedDiscoveryCatalogueItem,
  type MobileFeaturedDiscoveryMarket,
} from "@/lib/home/mobile-featured-discovery.catalog";

export type MobileFeaturedDiscoveryItem = MobileFeaturedDiscoveryCatalogueItem;

type FeaturedSelectionInput = {
  marketCountry?: string | null;
  now?: Date;
  limit?: number;
  seedBucket?: string | null;
  items?: ReadonlyArray<MobileFeaturedDiscoveryItem>;
};

const FEATURED_ALLOWED_CATEGORIES: ReadonlySet<MobileQuickSearchCategory> = new Set([
  "rent",
  "buy",
  "shortlet",
  "off_plan",
  "all",
]);

const FEATURED_DEFAULT_LIMIT = 6;
const FEATURED_DEFAULT_BUCKET = "public-mobile";

function normalizeMarketTag(countryCode: string | null | undefined): MobileFeaturedDiscoveryMarket {
  const normalized = countryCode?.trim().toUpperCase() ?? "";
  return MOBILE_FEATURED_DISCOVERY_MARKETS.includes(normalized as MobileFeaturedDiscoveryMarket)
    ? (normalized as MobileFeaturedDiscoveryMarket)
    : "GLOBAL";
}

function isIsoDate(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const normalized = ((offset % items.length) + items.length) % items.length;
  if (normalized === 0) return [...items];
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function sortCatalogueItems(items: MobileFeaturedDiscoveryItem[]): MobileFeaturedDiscoveryItem[] {
  return [...items].sort((left, right) => {
    const leftPriority = Number.isFinite(left.priority) ? Number(left.priority) : 0;
    const rightPriority = Number.isFinite(right.priority) ? Number(right.priority) : 0;
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    return left.id.localeCompare(right.id);
  });
}

function dedupeById(items: MobileFeaturedDiscoveryItem[]): MobileFeaturedDiscoveryItem[] {
  const seen = new Set<string>();
  const deduped: MobileFeaturedDiscoveryItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

function isDateWithinWindow(item: MobileFeaturedDiscoveryItem, dateKey: string): boolean {
  if (item.validFrom && dateKey < item.validFrom) return false;
  if (item.validTo && dateKey > item.validTo) return false;
  return true;
}

export function validateMobileFeaturedDiscoveryCatalogue(input: {
  items?: ReadonlyArray<MobileFeaturedDiscoveryItem>;
  now?: Date;
}): { items: MobileFeaturedDiscoveryItem[]; warnings: string[] } {
  const dateKey = toDateKey(input.now ?? new Date());
  const warnings: string[] = [];
  const items = input.items ?? MOBILE_FEATURED_DISCOVERY_CATALOGUE;
  const valid: MobileFeaturedDiscoveryItem[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      warnings.push("Skipping invalid featured item: non-object entry.");
      continue;
    }
    if (!item.id || typeof item.id !== "string") {
      warnings.push("Skipping invalid featured item: missing string id.");
      continue;
    }
    if (seenIds.has(item.id)) {
      warnings.push(`Skipping invalid featured item: duplicate id "${item.id}".`);
      continue;
    }
    seenIds.add(item.id);
    if (!item.title?.trim()) {
      warnings.push(`Skipping invalid featured item "${item.id}": missing title.`);
      continue;
    }
    if (!item.subtitle?.trim()) {
      warnings.push(`Skipping invalid featured item "${item.id}": missing subtitle.`);
      continue;
    }
    if (!item.tag?.trim()) {
      warnings.push(`Skipping invalid featured item "${item.id}": missing tag.`);
      continue;
    }
    if (!FEATURED_ALLOWED_CATEGORIES.has(item.category)) {
      warnings.push(`Skipping invalid featured item "${item.id}": unknown category "${item.category}".`);
      continue;
    }
    if (!Array.isArray(item.marketTags) || item.marketTags.length === 0) {
      warnings.push(`Skipping invalid featured item "${item.id}": missing marketTags.`);
      continue;
    }
    const hasSupportedMarket = item.marketTags.some((market) =>
      MOBILE_FEATURED_DISCOVERY_MARKETS.includes(market)
    );
    if (!hasSupportedMarket) {
      warnings.push(`Skipping invalid featured item "${item.id}": unsupported market tags.`);
      continue;
    }
    if (item.validFrom && !isIsoDate(item.validFrom)) {
      warnings.push(`Skipping invalid featured item "${item.id}": invalid validFrom.`);
      continue;
    }
    if (item.validTo && !isIsoDate(item.validTo)) {
      warnings.push(`Skipping invalid featured item "${item.id}": invalid validTo.`);
      continue;
    }
    if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
      warnings.push(`Skipping invalid featured item "${item.id}": validFrom is after validTo.`);
      continue;
    }
    if (item.disabled) continue;
    if (!isDateWithinWindow(item, dateKey)) continue;
    valid.push(item);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of warnings) {
      console.warn(`[mobile-featured-discovery] ${warning}`);
    }
  }

  return {
    items: valid,
    warnings,
  };
}

export function getMobileFeaturedDiscoveryItems(input: FeaturedSelectionInput = {}): MobileFeaturedDiscoveryItem[] {
  const dateKey = toDateKey(input.now ?? new Date());
  const marketTag = normalizeMarketTag(input.marketCountry);
  const limit = Math.max(1, input.limit ?? FEATURED_DEFAULT_LIMIT);
  const seedBucket = input.seedBucket?.trim() || FEATURED_DEFAULT_BUCKET;
  const { items: catalogue } = validateMobileFeaturedDiscoveryCatalogue({
    now: input.now,
    items: input.items,
  });

  const globalItems = sortCatalogueItems(
    catalogue.filter((item) => item.marketTags.includes("GLOBAL"))
  );
  const marketItems =
    marketTag === "GLOBAL"
      ? globalItems
      : sortCatalogueItems(catalogue.filter((item) => item.marketTags.includes(marketTag)));
  const fallbackItems =
    marketTag === "GLOBAL"
      ? []
      : sortCatalogueItems(globalItems.filter((item) => !item.marketTags.includes(marketTag)));

  const marketSeed = hashString(`${marketTag}|${seedBucket}|${dateKey}`);
  const rotatedMarket = rotate(marketItems, marketSeed);
  if (rotatedMarket.length >= limit) {
    return rotatedMarket.slice(0, limit);
  }

  const fallbackSeed = hashString(`GLOBAL|${seedBucket}|${dateKey}`);
  const rotatedFallback = rotate(fallbackItems, fallbackSeed);
  return dedupeById([...rotatedMarket, ...rotatedFallback]).slice(0, limit);
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
