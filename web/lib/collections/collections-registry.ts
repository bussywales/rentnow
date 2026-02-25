import type {
  DiscoveryIntent,
  DiscoveryKind,
  DiscoveryMarket,
  DiscoverySurface,
} from "@/lib/discovery/market-taxonomy";

export type CollectionMarketTag = DiscoveryMarket | "ALL";

export type StaticCollectionDefinition = {
  slug: string;
  title: string;
  description: string;
  surface: DiscoverySurface;
  primaryKind: DiscoveryKind;
  intent: DiscoveryIntent;
  marketTags: CollectionMarketTag[];
  params: Record<string, string>;
  disabled?: boolean;
  validFrom?: string;
  validTo?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_MARKET_TAGS = new Set<CollectionMarketTag>(["ALL", "GLOBAL", "NG", "CA", "UK", "US"]);
const SENSITIVE_TOKENS = [
  "race",
  "ethnicity",
  "religion",
  "tribe",
  "sexual orientation",
  "pregnant",
  "disability",
];

const RAW_COLLECTIONS_REGISTRY: ReadonlyArray<StaticCollectionDefinition> = [
  {
    slug: "weekend-getaways",
    title: "Weekend getaways",
    description: "Shortlet picks for quick city breaks and flexible weekend plans.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "2", sort: "recommended" },
  },
  {
    slug: "family-friendly-stays",
    title: "Family-friendly stays",
    description: "Comfort-first shortlets with practical space for family trips.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "4", sort: "recommended" },
  },
  {
    slug: "business-travel-stays",
    title: "Business travel stays",
    description: "Reliable shortlets for work trips and compact schedules.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "1", sort: "recommended" },
  },
  {
    slug: "budget-friendly-stays",
    title: "Budget-friendly stays",
    description: "High-value shortlets with smart pricing and trusted hosts.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "2", sort: "price_asc" },
  },
  {
    slug: "near-transport-hubs",
    title: "Near transport hubs",
    description: "Listings curated around well-connected city zones.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "2", sort: "recommended" },
  },
  {
    slug: "homes-for-rent",
    title: "Homes for rent",
    description: "Market-aware rental picks with clear filters and fast browsing.",
    surface: "PROPERTIES_FEATURED",
    primaryKind: "property",
    intent: "rent",
    marketTags: ["ALL"],
    params: { category: "rent", intent: "rent" },
  },
  {
    slug: "verified-homes-for-sale",
    title: "Verified homes for sale",
    description: "Buy-side inventory selected for trust and clarity.",
    surface: "PROPERTIES_FEATURED",
    primaryKind: "property",
    intent: "buy",
    marketTags: ["ALL"],
    params: { category: "buy", intent: "buy" },
  },
  {
    slug: "off-plan-opportunities",
    title: "Off-plan opportunities",
    description: "New-build and pipeline projects to track by market.",
    surface: "PROPERTIES_FEATURED",
    primaryKind: "property",
    intent: "buy",
    marketTags: ["ALL"],
    params: { category: "off_plan", intent: "off_plan", listingIntent: "off_plan" },
  },
  {
    slug: "rentals-new-this-week",
    title: "New rentals this week",
    description: "Fresh rental inventory surfaced for fast shortlist decisions.",
    surface: "PROPERTIES_FEATURED",
    primaryKind: "property",
    intent: "rent",
    marketTags: ["ALL"],
    params: { category: "rent", intent: "rent", recent: "7" },
  },
];

function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hasSensitiveToken(value: string): string | null {
  const normalized = value.toLowerCase();
  const token = SENSITIVE_TOKENS.find((candidate) => normalized.includes(candidate));
  return token ?? null;
}

export type CollectionsRegistryValidationResult = {
  items: StaticCollectionDefinition[];
  warnings: string[];
};

export function validateCollectionsRegistry(input: {
  items: ReadonlyArray<StaticCollectionDefinition>;
  now?: Date;
}): CollectionsRegistryValidationResult {
  const today = toDateKey(input.now ?? new Date());
  const warnings: string[] = [];
  const validItems: StaticCollectionDefinition[] = [];
  const seenSlugs = new Set<string>();

  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      warnings.push("Skipping invalid collection: non-object entry.");
      continue;
    }
    if (!item.slug || !SLUG_RE.test(item.slug)) {
      warnings.push("Skipping invalid collection: slug must be kebab-case.");
      continue;
    }
    if (seenSlugs.has(item.slug)) {
      warnings.push(`Skipping invalid collection "${item.slug}": duplicate slug.`);
      continue;
    }
    seenSlugs.add(item.slug);
    if (!item.title?.trim()) {
      warnings.push(`Skipping invalid collection "${item.slug}": missing title.`);
      continue;
    }
    if (!item.description?.trim()) {
      warnings.push(`Skipping invalid collection "${item.slug}": missing description.`);
      continue;
    }
    if (!item.surface) {
      warnings.push(`Skipping invalid collection "${item.slug}": missing surface.`);
      continue;
    }
    if (item.primaryKind !== "shortlet" && item.primaryKind !== "property") {
      warnings.push(`Skipping invalid collection "${item.slug}": invalid primaryKind.`);
      continue;
    }
    if (!Array.isArray(item.marketTags) || item.marketTags.length === 0) {
      warnings.push(`Skipping invalid collection "${item.slug}": marketTags cannot be empty.`);
      continue;
    }
    const unknownMarketTags = item.marketTags.filter((tag) => !ALLOWED_MARKET_TAGS.has(tag));
    if (unknownMarketTags.length > 0) {
      warnings.push(
        `Skipping invalid collection "${item.slug}": unknown market tags ${unknownMarketTags.join(", ")}.`
      );
      continue;
    }
    if (!item.params || typeof item.params !== "object" || Array.isArray(item.params)) {
      warnings.push(`Skipping invalid collection "${item.slug}": params must be a key/value record.`);
      continue;
    }
    if (item.validFrom && !isIsoDate(item.validFrom)) {
      warnings.push(`Skipping invalid collection "${item.slug}": invalid validFrom date.`);
      continue;
    }
    if (item.validTo && !isIsoDate(item.validTo)) {
      warnings.push(`Skipping invalid collection "${item.slug}": invalid validTo date.`);
      continue;
    }
    if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
      warnings.push(`Skipping invalid collection "${item.slug}": validFrom is later than validTo.`);
      continue;
    }
    const titleToken = hasSensitiveToken(item.title);
    if (titleToken) {
      warnings.push(`Skipping invalid collection "${item.slug}": restricted token "${titleToken}" in title.`);
      continue;
    }
    const descriptionToken = hasSensitiveToken(item.description);
    if (descriptionToken) {
      warnings.push(
        `Skipping invalid collection "${item.slug}": restricted token "${descriptionToken}" in description.`
      );
      continue;
    }

    if (item.disabled) continue;
    if (item.validFrom && today < item.validFrom) continue;
    if (item.validTo && today > item.validTo) continue;
    validItems.push(item);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of warnings) {
      console.warn(`[collections-registry] ${warning}`);
    }
  }

  return {
    items: validItems,
    warnings,
  };
}

export function resolveCollectionsRegistry(now?: Date): StaticCollectionDefinition[] {
  return validateCollectionsRegistry({
    items: RAW_COLLECTIONS_REGISTRY,
    now,
  }).items;
}

export function getCollectionBySlug(slug: string, now?: Date): StaticCollectionDefinition | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return resolveCollectionsRegistry(now).find((collection) => collection.slug === normalizedSlug) ?? null;
}

