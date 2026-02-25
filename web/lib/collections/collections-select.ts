import {
  buildPropertiesFeaturedHref,
  buildShortletsFeaturedHref,
  selectDiscoveryItems,
  type DiscoveryCatalogueItem,
  type DiscoveryMarket,
} from "@/lib/discovery";
import { normalizeDiscoveryMarket } from "@/lib/discovery/market-taxonomy";
import {
  getCollectionBySlug,
  type CollectionMarketTag,
  type StaticCollectionDefinition,
} from "@/lib/collections/collections-registry";

export type CollectionCard = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  href: string;
};

function supportsMarket(collectionTags: CollectionMarketTag[], market: DiscoveryMarket): boolean {
  if (collectionTags.includes("ALL")) return true;
  if (collectionTags.includes(market)) return true;
  return market !== "GLOBAL" && collectionTags.includes("GLOBAL");
}

function shouldIncludeItem(item: DiscoveryCatalogueItem, collection: StaticCollectionDefinition): boolean {
  if (collection.primaryKind === "shortlet") {
    return item.kind === "shortlet" || item.intent === "shortlet";
  }

  if (item.kind !== "property") return false;
  if (collection.intent === "rent") return item.intent === "rent";
  if (collection.intent === "buy") return item.intent === "buy";
  return true;
}

function resolveCardTag(item: DiscoveryCatalogueItem, collection: StaticCollectionDefinition): string {
  const city = (item.params.city ?? item.params.where ?? "").trim();
  const prefix = collection.primaryKind === "shortlet" ? "Shortlet" : "Homes";
  if (!city) return prefix;
  return `${prefix}: ${city}`;
}

function buildItemHref(item: DiscoveryCatalogueItem, marketCountry: string): string {
  if (item.kind === "shortlet" || item.intent === "shortlet") {
    return buildShortletsFeaturedHref({
      item,
      marketCountry,
    });
  }
  return buildPropertiesFeaturedHref(item);
}

function toVirtualCollectionItem(collection: StaticCollectionDefinition): DiscoveryCatalogueItem {
  return {
    id: `collection-${collection.slug}`,
    title: collection.title,
    subtitle: collection.description,
    kind: collection.primaryKind,
    intent: collection.intent,
    marketTags: ["GLOBAL"],
    params: collection.params,
    priority: 100,
    surfaces: [collection.surface],
  };
}

export function buildCollectionResultsHref(input: {
  slug: string;
  marketCountry?: string | null;
  now?: Date;
}): string | null {
  const collection = getCollectionBySlug(input.slug, input.now);
  if (!collection) return null;

  const virtualItem = toVirtualCollectionItem(collection);
  return buildItemHref(virtualItem, input.marketCountry ?? "GLOBAL");
}

export function getCollectionCards(input: {
  slug: string;
  marketCountry?: string | null;
  limit?: number;
  now?: Date;
}): CollectionCard[] {
  const collection = getCollectionBySlug(input.slug, input.now);
  if (!collection) return [];

  const normalizedMarket = normalizeDiscoveryMarket(input.marketCountry);
  if (!supportsMarket(collection.marketTags, normalizedMarket)) {
    return [];
  }

  const limit = Math.max(1, input.limit ?? 8);
  const selected = selectDiscoveryItems({
    market: normalizedMarket,
    surface: collection.surface,
    limit: Math.max(10, limit * 3),
    seedDate: input.now,
    seedBucket: `collections:${collection.slug}`,
  });

  const cards = selected
    .filter((item) => shouldIncludeItem(item, collection))
    .map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle?.trim() || collection.description,
      tag: resolveCardTag(item, collection),
      href: buildItemHref(item, normalizedMarket),
    }));

  return cards.slice(0, limit);
}

