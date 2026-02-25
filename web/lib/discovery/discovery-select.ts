import { DISCOVERY_CATALOGUE, type DiscoveryCatalogueItem } from "@/lib/discovery/discovery-catalogue";
import {
  normalizeDiscoveryMarket,
  type DiscoveryMarket,
  type DiscoverySurface,
} from "@/lib/discovery/market-taxonomy";
import { validateDiscoveryCatalogue } from "@/lib/discovery/discovery-validate";

type SelectDiscoveryItemsInput = {
  market?: string | null;
  surface: DiscoverySurface;
  limit: number;
  seedDate?: Date;
  seedBucket?: string | null;
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: ReadonlyArray<T>, seed: number): T[] {
  const copy = [...items];
  const random = mulberry32(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function dedupeById(items: ReadonlyArray<DiscoveryCatalogueItem>): DiscoveryCatalogueItem[] {
  const seen = new Set<string>();
  const deduped: DiscoveryCatalogueItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

function filterForMarket(items: ReadonlyArray<DiscoveryCatalogueItem>, market: DiscoveryMarket) {
  if (market === "GLOBAL") {
    return {
      marketItems: [] as DiscoveryCatalogueItem[],
      fallbackItems: items.filter((item) => item.marketTags.includes("GLOBAL")),
    };
  }
  return {
    marketItems: items.filter((item) => item.marketTags.includes(market)),
    fallbackItems: items.filter(
      (item) => item.marketTags.includes("GLOBAL") && !item.marketTags.includes(market)
    ),
  };
}

export function selectDiscoveryItems(input: SelectDiscoveryItemsInput): DiscoveryCatalogueItem[] {
  const limit = Math.max(1, Math.trunc(input.limit || 0));
  const market = normalizeDiscoveryMarket(input.market);
  const dateKey = toDateKey(input.seedDate ?? new Date());
  const bucket = input.seedBucket?.trim() || "default";

  const { items: validItems } = validateDiscoveryCatalogue({
    items: input.items ?? DISCOVERY_CATALOGUE,
    now: input.seedDate,
  });
  const surfaceItems = validItems.filter((item) => item.surfaces.includes(input.surface));
  const { marketItems, fallbackItems } = filterForMarket(surfaceItems, market);

  const marketShuffled = seededShuffle(
    marketItems,
    hashSeed(`${input.surface}|${market}|${dateKey}|${bucket}|market`)
  );
  if (marketShuffled.length >= limit) {
    return dedupeById(marketShuffled).slice(0, limit);
  }

  const fallbackShuffled = seededShuffle(
    fallbackItems,
    hashSeed(`${input.surface}|${market}|${dateKey}|${bucket}|fallback`)
  );

  return dedupeById([...marketShuffled, ...fallbackShuffled]).slice(0, limit);
}
