import {
  buildPropertiesFeaturedHref,
  buildShortletsFeaturedHref,
  resolveDiscoveryTrustBadges,
  selectDiscoveryItems,
  normalizeDiscoveryMarket,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery";
import type {
  BuildRecommendedNextItemsInput,
  RecommendedNextItem,
  RecoItemKind,
  RecoReason,
  RecoSignalItem,
} from "@/lib/reco/reco-schema";
import { normalizeLimit, seededRank, toDateKey } from "@/lib/reco/reco-utils";

const ALL_HOME_FALLBACK_REASON: RecoReason = "Popular in your market";

type ParsedBrowseSignal = {
  kind: RecoItemKind | null;
  intent: "shortlet" | "rent" | "buy" | "off_plan" | "all" | null;
};

function isOffPlanItem(item: DiscoveryCatalogueItem): boolean {
  const intent = (item.params.intent ?? item.params.category ?? item.params.listingIntent ?? "")
    .trim()
    .toLowerCase();
  return intent === "off_plan" || intent === "off-plan";
}

function isAllHomesItem(item: DiscoveryCatalogueItem): boolean {
  const intent = (item.params.intent ?? item.params.category ?? "").trim().toLowerCase();
  return intent === "all";
}

function resolveKindFromHref(href: string | null | undefined): RecoItemKind | null {
  if (!href) return null;
  const normalized = href.trim().toLowerCase();
  if (normalized.startsWith("/shortlets")) return "shortlet";
  if (normalized.startsWith("/properties")) return "property";
  return null;
}

function resolveIntentFromHref(href: string | null | undefined): ParsedBrowseSignal["intent"] {
  if (!href) return null;
  if (href.startsWith("/shortlets")) return "shortlet";
  if (!href.startsWith("/properties")) return null;
  const queryPart = href.includes("?") ? href.split("?")[1] : "";
  const params = new URLSearchParams(queryPart);
  const intent = (params.get("intent") ?? params.get("category") ?? params.get("listingIntent") ?? "")
    .trim()
    .toLowerCase();
  if (!intent) return null;
  if (intent === "off_plan" || intent === "off-plan") return "off_plan";
  if (intent === "shortlet" || intent === "short-lets") return "shortlet";
  if (intent === "rent") return "rent";
  if (intent === "buy" || intent === "sale") return "buy";
  if (intent === "all") return "all";
  return null;
}

function normalizeSignalItems(items: ReadonlyArray<RecoSignalItem> | undefined): RecoSignalItem[] {
  if (!items?.length) return [];
  return items
    .map((item) => ({
      id: String(item.id ?? "").trim(),
      kind: item.kind,
      href: String(item.href ?? "").trim(),
      marketCountry: item.marketCountry ?? null,
      timestamp: item.timestamp ?? null,
    }))
    .filter((item) => !!item.id && (item.kind === "shortlet" || item.kind === "property") && !!item.href);
}

function resolveDominantKind(input: {
  savedItems: ReadonlyArray<RecoSignalItem>;
  viewedItems: ReadonlyArray<RecoSignalItem>;
  browseKind: RecoItemKind | null;
  searchKind: RecoItemKind | null;
}): RecoItemKind | null {
  if (input.browseKind) return input.browseKind;
  if (input.searchKind) return input.searchKind;

  let shortletScore = 0;
  let propertyScore = 0;
  for (const item of input.savedItems) {
    if (item.kind === "shortlet") shortletScore += 2;
    if (item.kind === "property") propertyScore += 2;
  }
  for (const item of input.viewedItems) {
    if (item.kind === "shortlet") shortletScore += 1;
    if (item.kind === "property") propertyScore += 1;
  }
  if (shortletScore === propertyScore) return null;
  return shortletScore > propertyScore ? "shortlet" : "property";
}

function resolveTag(item: DiscoveryCatalogueItem): string {
  const city = (item.params.city ?? item.params.where ?? "").trim();
  if (item.kind === "shortlet" || item.intent === "shortlet") {
    return city ? `${city} shortlets` : "Shortlets";
  }
  if (isOffPlanItem(item)) {
    return city ? `Off-plan: ${city}` : "Off-plan";
  }
  if (item.intent === "buy") {
    return city ? `For sale: ${city}` : "For sale";
  }
  if (isAllHomesItem(item)) {
    return city ? `All homes: ${city}` : "All homes";
  }
  return city ? `To rent: ${city}` : "To rent";
}

function buildHref(item: DiscoveryCatalogueItem, marketCountry: string): string {
  if (item.kind === "shortlet" || item.intent === "shortlet") {
    return buildShortletsFeaturedHref({
      item,
      marketCountry,
    });
  }
  return buildPropertiesFeaturedHref(item);
}

function scoreItem(input: {
  item: DiscoveryCatalogueItem;
  dominantKind: RecoItemKind | null;
  browseIntent: ParsedBrowseSignal["intent"];
  hasSavedShortlet: boolean;
  hasSavedProperty: boolean;
  hasViewedShortlet: boolean;
  hasViewedProperty: boolean;
}): number {
  const { item } = input;
  let score = item.priority ?? 0;
  if (input.dominantKind && item.kind === input.dominantKind) {
    score += 35;
  }

  if (input.browseIntent === "shortlet" && (item.kind === "shortlet" || item.intent === "shortlet")) {
    score += 30;
  } else if (input.browseIntent === "rent" && item.intent === "rent") {
    score += 22;
  } else if (input.browseIntent === "buy" && item.intent === "buy") {
    score += 22;
  } else if (input.browseIntent === "off_plan" && isOffPlanItem(item)) {
    score += 20;
  }

  if (input.hasSavedShortlet && item.kind === "shortlet") score += 12;
  if (input.hasSavedProperty && item.kind === "property") score += 12;
  if (input.hasViewedShortlet && item.kind === "shortlet") score += 8;
  if (input.hasViewedProperty && item.kind === "property") score += 8;

  return score;
}

function resolveReason(input: {
  item: DiscoveryCatalogueItem;
  browseKind: RecoItemKind | null;
  hasSavedShortlet: boolean;
  hasSavedProperty: boolean;
  hasViewedShortlet: boolean;
  hasViewedProperty: boolean;
}): RecoReason {
  if (input.browseKind && input.item.kind === input.browseKind) {
    return "Continue browsing";
  }
  if (
    (input.item.kind === "shortlet" && input.hasSavedShortlet) ||
    (input.item.kind === "property" && input.hasSavedProperty)
  ) {
    return "Based on your saved";
  }
  if (
    (input.item.kind === "shortlet" && input.hasViewedShortlet) ||
    (input.item.kind === "property" && input.hasViewedProperty)
  ) {
    return "Because you viewed";
  }
  return ALL_HOME_FALLBACK_REASON;
}

export function buildRecommendedNextItems(input: BuildRecommendedNextItemsInput): RecommendedNextItem[] {
  const now = input.now ?? new Date();
  const dateKey = toDateKey(now);
  const limit = normalizeLimit(input.limit, 8);
  const market = normalizeDiscoveryMarket(input.marketCountry);
  const seedBucket = (input.seedBucket ?? "home-mobile").trim() || "home-mobile";

  const savedItems = normalizeSignalItems(input.savedItems);
  const viewedItems = normalizeSignalItems(input.viewedItems);

  const browseKind = resolveKindFromHref(input.lastBrowseHref);
  const searchKind = resolveKindFromHref(input.lastSearchHref);
  const browseIntent = resolveIntentFromHref(input.lastBrowseHref) ?? resolveIntentFromHref(input.lastSearchHref);

  const dominantKind = resolveDominantKind({
    savedItems,
    viewedItems,
    browseKind,
    searchKind,
  });

  const hasSavedShortlet = savedItems.some((item) => item.kind === "shortlet");
  const hasSavedProperty = savedItems.some((item) => item.kind === "property");
  const hasViewedShortlet = viewedItems.some((item) => item.kind === "shortlet");
  const hasViewedProperty = viewedItems.some((item) => item.kind === "property");

  const blockedIds = new Set<string>([
    ...savedItems.map((item) => item.id),
    ...viewedItems.map((item) => item.id),
  ]);

  const candidates = selectDiscoveryItems({
    market,
    surface: "HOME_FEATURED",
    limit: Math.max(limit * 4, 18),
    seedDate: now,
    seedBucket: `reco:${seedBucket}`,
    items: input.items,
  }).filter((item) => !blockedIds.has(item.id));

  const scored = candidates
    .map((item) => ({
      item,
      score: scoreItem({
        item,
        dominantKind,
        browseIntent,
        hasSavedShortlet,
        hasSavedProperty,
        hasViewedShortlet,
        hasViewedProperty,
      }),
      rank: seededRank(`${market}|${dateKey}|${seedBucket}|${item.id}`),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return right.rank - left.rank;
    });

  return scored.slice(0, limit).map(({ item }) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: (item.subtitle ?? "").trim() || "Explore tailored picks for this market.",
    tag: resolveTag(item),
    href: buildHref(item, market),
    reason: resolveReason({
      item,
      browseKind,
      hasSavedShortlet,
      hasSavedProperty,
      hasViewedShortlet,
      hasViewedProperty,
    }),
    badges: resolveDiscoveryTrustBadges({
      item,
      now,
    }),
  }));
}
