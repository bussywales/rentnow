import type {
  DiscoveryIntent,
  DiscoveryKind,
  DiscoveryMarket,
  DiscoverySurface,
} from "@/lib/discovery/market-taxonomy";
import { normalizeDiscoveryMarket } from "@/lib/discovery/market-taxonomy";

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
const ALLOWED_MARKET_TAGS = new Set<CollectionMarketTag>(["ALL", "GLOBAL", "NG", "CA", "GB", "US"]);
const SENSITIVE_TOKENS = [
  "race",
  "ethnicity",
  "religion",
  "tribe",
  "sexual orientation",
  "pregnant",
  "disability",
];

export const COLLECTIONS_VALIDATION_REASON_CODES = [
  "NON_OBJECT_ENTRY",
  "INVALID_SLUG",
  "DUPLICATE_SLUG",
  "MISSING_TITLE",
  "MISSING_DESCRIPTION",
  "MISSING_SURFACE",
  "INVALID_PRIMARY_KIND",
  "EMPTY_MARKET_TAGS",
  "INVALID_MARKET_TAG",
  "MISSING_PARAMS",
  "INVALID_VALID_FROM",
  "INVALID_VALID_TO",
  "INVALID_DATE_RANGE",
  "SENSITIVE_TOKEN",
  "DISABLED",
  "NOT_YET_ACTIVE",
  "EXPIRED",
] as const;

export type CollectionsValidationReasonCode = (typeof COLLECTIONS_VALIDATION_REASON_CODES)[number];

export type CollectionsValidationIssue = {
  slug: string | null;
  reasonCodes: CollectionsValidationReasonCode[];
  details: string;
};

export type CollectionsValidationDiagnostics = {
  totalInput: number;
  validCount: number;
  invalidCount: number;
  disabledCount: number;
  notYetActiveCount: number;
  expiredCount: number;
  issues: CollectionsValidationIssue[];
};

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
  diagnostics?: CollectionsValidationDiagnostics;
};

type ValidationMode = "runtime" | "diagnostics";

export function validateCollectionsRegistry(input: {
  items: ReadonlyArray<StaticCollectionDefinition>;
  now?: Date;
  mode?: ValidationMode;
}): CollectionsRegistryValidationResult {
  const mode = input.mode ?? "runtime";
  const today = toDateKey(input.now ?? new Date());
  const warnings: string[] = [];
  const validItems: StaticCollectionDefinition[] = [];
  const seenSlugs = new Set<string>();
  const issues: CollectionsValidationIssue[] = [];
  let disabledCount = 0;
  let notYetActiveCount = 0;
  let expiredCount = 0;

  function addIssue(
    slug: string | null,
    reasonCode: CollectionsValidationReasonCode,
    details: string,
    options?: { addWarning?: boolean }
  ) {
    issues.push({
      slug,
      reasonCodes: [reasonCode],
      details,
    });
    if (options?.addWarning === false) return;
    if (reasonCode === "NON_OBJECT_ENTRY") {
      warnings.push("Skipping invalid collection: non-object entry.");
      return;
    }
    warnings.push(`Skipping invalid collection "${slug ?? "unknown"}": ${details}.`);
  }

  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      addIssue(null, "NON_OBJECT_ENTRY", "non-object entry");
      continue;
    }
    if (!item.slug || !SLUG_RE.test(item.slug)) {
      addIssue(item.slug ?? null, "INVALID_SLUG", "slug must be kebab-case");
      continue;
    }
    if (seenSlugs.has(item.slug)) {
      addIssue(item.slug, "DUPLICATE_SLUG", "duplicate slug");
      continue;
    }
    seenSlugs.add(item.slug);
    if (!item.title?.trim()) {
      addIssue(item.slug, "MISSING_TITLE", "missing title");
      continue;
    }
    if (!item.description?.trim()) {
      addIssue(item.slug, "MISSING_DESCRIPTION", "missing description");
      continue;
    }
    if (!item.surface) {
      addIssue(item.slug, "MISSING_SURFACE", "missing surface");
      continue;
    }
    if (item.primaryKind !== "shortlet" && item.primaryKind !== "property") {
      addIssue(item.slug, "INVALID_PRIMARY_KIND", "invalid primaryKind");
      continue;
    }
    if (!Array.isArray(item.marketTags) || item.marketTags.length === 0) {
      addIssue(item.slug, "EMPTY_MARKET_TAGS", "marketTags cannot be empty");
      continue;
    }
    const unknownMarketTags = item.marketTags.filter((tag) => !ALLOWED_MARKET_TAGS.has(tag));
    if (unknownMarketTags.length > 0) {
      addIssue(item.slug, "INVALID_MARKET_TAG", `unknown market tags ${unknownMarketTags.join(", ")}`);
      continue;
    }
    if (!item.params || typeof item.params !== "object" || Array.isArray(item.params)) {
      addIssue(item.slug, "MISSING_PARAMS", "params must be a key/value record");
      continue;
    }
    if (item.validFrom && !isIsoDate(item.validFrom)) {
      addIssue(item.slug, "INVALID_VALID_FROM", "invalid validFrom date");
      continue;
    }
    if (item.validTo && !isIsoDate(item.validTo)) {
      addIssue(item.slug, "INVALID_VALID_TO", "invalid validTo date");
      continue;
    }
    if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
      addIssue(item.slug, "INVALID_DATE_RANGE", "validFrom is later than validTo");
      continue;
    }
    const titleToken = hasSensitiveToken(item.title);
    if (titleToken) {
      addIssue(item.slug, "SENSITIVE_TOKEN", `restricted token "${titleToken}" in title`);
      continue;
    }
    const descriptionToken = hasSensitiveToken(item.description);
    if (descriptionToken) {
      addIssue(item.slug, "SENSITIVE_TOKEN", `restricted token "${descriptionToken}" in description`);
      continue;
    }

    if (item.disabled) {
      disabledCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.slug, "DISABLED", "disabled", { addWarning: false });
      }
      continue;
    }
    if (item.validFrom && today < item.validFrom) {
      notYetActiveCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.slug, "NOT_YET_ACTIVE", `starts at ${item.validFrom}`, { addWarning: false });
      }
      continue;
    }
    if (item.validTo && today > item.validTo) {
      expiredCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.slug, "EXPIRED", `expired at ${item.validTo}`, { addWarning: false });
      }
      continue;
    }
    validItems.push(item);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of warnings) {
      console.warn(`[collections-registry] ${warning}`);
    }
  }

  if (mode === "diagnostics") {
    return {
      items: validItems,
      warnings,
      diagnostics: {
        totalInput: input.items.length,
        validCount: validItems.length,
        invalidCount: issues.length - disabledCount - notYetActiveCount - expiredCount,
        disabledCount,
        notYetActiveCount,
        expiredCount,
        issues,
      },
    };
  }

  return { items: validItems, warnings };
}

export function resolveCollectionsRegistry(now?: Date): StaticCollectionDefinition[] {
  return validateCollectionsRegistry({
    items: RAW_COLLECTIONS_REGISTRY,
    now,
  }).items;
}

export function getCollectionsRegistryDiagnostics(now?: Date): CollectionsRegistryValidationResult {
  return validateCollectionsRegistry({
    items: RAW_COLLECTIONS_REGISTRY,
    now,
    mode: "diagnostics",
  });
}

export function getCollectionBySlug(slug: string, now?: Date): StaticCollectionDefinition | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return resolveCollectionsRegistry(now).find((collection) => collection.slug === normalizedSlug) ?? null;
}

export function listCollectionsForMarket(input: {
  marketCountry?: string | null;
  now?: Date;
}): StaticCollectionDefinition[] {
  const market = normalizeDiscoveryMarket(input.marketCountry);
  return resolveCollectionsRegistry(input.now).filter((collection) => {
    if (collection.marketTags.includes("ALL")) return true;
    if (collection.marketTags.includes(market as DiscoveryMarket)) return true;
    return market !== "GLOBAL" && collection.marketTags.includes("GLOBAL");
  });
}
