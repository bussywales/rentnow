import {
  selectDiscoveryItems,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";

const ALLOWED_SHORTLETS_QUERY_KEYS = [
  "where",
  "guests",
  "checkIn",
  "checkOut",
  "bookingMode",
  "sort",
  "placeId",
  "lat",
  "lng",
  "bbox",
  "bounds",
  "priceDisplay",
  "mapAuto",
] as const;

export type ShortletsFeaturedRailItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  href: string;
};

function resolveMarketLabel(countryCode: string): string {
  if (countryCode === "NG") return "Nigeria";
  if (countryCode === "CA") return "Canada";
  if (countryCode === "UK" || countryCode === "GB") return "United Kingdom";
  if (countryCode === "US") return "United States";
  return "Global";
}

function resolveShortletsWhereValue(item: DiscoveryCatalogueItem): string {
  const where = item.params.where?.trim();
  if (where) return where;
  const city = item.params.city?.trim();
  if (city) return city;
  const query = item.params.q?.trim();
  if (query) return query;
  return "";
}

export function buildShortletsFeaturedHref(input: {
  item: DiscoveryCatalogueItem;
  marketCountry: string;
}): string {
  const params = new URLSearchParams();
  for (const key of ALLOWED_SHORTLETS_QUERY_KEYS) {
    const value = input.item.params[key];
    const nextValue = typeof value === "string" ? value.trim() : "";
    if (nextValue) params.set(key, nextValue);
  }

  const where = resolveShortletsWhereValue(input.item);
  if (where) params.set("where", where);
  if (!params.get("guests")) params.set("guests", "1");

  const normalizedMarket = input.marketCountry.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalizedMarket)) {
    params.set("market", normalizedMarket);
  }

  const query = params.toString();
  return query ? `/shortlets?${query}` : "/shortlets";
}

export function selectShortletsFeaturedRailItems(input: {
  marketCountry: string;
  limit?: number;
  now?: Date;
  seedBucket?: string;
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
}): ShortletsFeaturedRailItem[] {
  const limit = Math.max(1, input.limit ?? 6);
  const selection = selectDiscoveryItems({
    market: input.marketCountry,
    surface: "SHORTLETS_FEATURED",
    limit: Math.max(limit * 2, 8),
    seedDate: input.now,
    seedBucket: input.seedBucket ?? "shortlets-featured-rail",
    items: input.items,
  });

  const onlyShortletItems = selection.filter(
    (item) => item.kind === "shortlet" || item.intent === "shortlet"
  );
  const marketLabel = resolveMarketLabel(input.marketCountry.trim().toUpperCase());

  return onlyShortletItems.slice(0, limit).map((item) => {
    const where = resolveShortletsWhereValue(item);
    const subtitle = (item.subtitle ?? "").trim() || "Explore shortlets picked for this market.";
    return {
      id: item.id,
      title: item.title,
      subtitle,
      tag: where ? `${where} shortlets` : `${marketLabel} shortlets`,
      href: buildShortletsFeaturedHref({
        item,
        marketCountry: input.marketCountry,
      }),
    };
  });
}
