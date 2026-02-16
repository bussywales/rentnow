import type { ParsedSearchFilters, RentalType } from "@/lib/types";
import { parseIntent } from "@/lib/search-intent";
import { mapSearchFilterToListingIntents } from "@/lib/listing-intents";

export type SavedSearchMatchFilters = {
  city: string | null;
  neighbourhood: string | null;
  country_code: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  bedroomsMode: "exact" | "minimum";
  listingIntent: "rent" | "buy" | null;
  rentalType: RentalType | null;
};

export type SavedSearchLike = {
  id: string;
  name: string;
  query_params: Record<string, unknown>;
  created_at?: string | null;
  last_checked_at?: string | null;
  last_notified_at?: string | null;
  is_active?: boolean | null;
};

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

export function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

export function normalizeSavedSearchFilters(
  filters: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const normalizedIntent = parseIntent(
    typeof filters.intent === "string"
      ? filters.intent
      : typeof filters.listingIntent === "string"
      ? filters.listingIntent
      : null
  );
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (key === "listingIntent") continue;
    normalized[key] = value;
  }
  if (normalizedIntent) {
    normalized.intent = normalizedIntent;
  }
  return normalized;
}

export function buildDefaultSavedSearchName(
  filters: Record<string, unknown>
) {
  const city = readString(filters.city);
  const neighbourhood = readString(filters.neighbourhood);
  if (neighbourhood) return `${neighbourhood} homes`;
  if (city) return `${city} homes`;
  const rentalType = readString(filters.rentalType);
  if (rentalType === "short_let") return "Short-let search";
  if (rentalType === "long_term") return "Long-term search";
  return "Followed search";
}

export function parseSavedSearchMatchFilters(
  filters: Record<string, unknown>
): SavedSearchMatchFilters {
  const city = readString(filters.city);
  const neighbourhood = readString(filters.neighbourhood);
  const countryCodeRaw = readString(filters.country_code);
  const minPrice = readNumber(filters.minPrice);
  const maxPrice = readNumber(filters.maxPrice);
  const bedrooms = readNumber(filters.bedrooms);
  const bedroomsMode = filters.bedroomsMode === "minimum" ? "minimum" : "exact";
  const listingIntentRaw = parseIntent(
    readString(
      typeof filters.intent === "string"
        ? filters.intent
        : typeof filters.listingIntent === "string"
        ? filters.listingIntent
        : null
    )
  );
  const listingIntent: "rent" | "buy" | null =
    listingIntentRaw === "rent" || listingIntentRaw === "buy"
      ? listingIntentRaw
      : null;
  const rentalTypeRaw = readString(filters.rentalType);
  const rentalType: RentalType | null =
    rentalTypeRaw === "short_let" || rentalTypeRaw === "long_term"
      ? rentalTypeRaw
      : null;

  return {
    city,
    neighbourhood,
    country_code: countryCodeRaw ? countryCodeRaw.toUpperCase() : null,
    minPrice: minPrice !== null ? Math.max(0, minPrice) : null,
    maxPrice: maxPrice !== null ? Math.max(0, maxPrice) : null,
    bedrooms: bedrooms !== null ? Math.max(0, bedrooms) : null,
    bedroomsMode,
    listingIntent,
    rentalType,
  };
}

export type SavedSearchMatchQuerySpec = {
  sinceIso: string;
  filters: SavedSearchMatchFilters;
};

export type SavedSearchMatchQueryLike<TSelf> = {
  gt: (column: string, value: string) => TSelf;
  ilike: (column: string, value: string) => TSelf;
  eq: (column: string, value: string | number | boolean) => TSelf;
  in: (column: string, values: string[]) => TSelf;
  gte: (column: string, value: number) => TSelf;
  lte: (column: string, value: number) => TSelf;
};

export function buildSavedSearchMatchQuerySpec(input: {
  filters: Record<string, unknown>;
  sinceIso: string;
}): SavedSearchMatchQuerySpec {
  return {
    sinceIso: input.sinceIso,
    filters: parseSavedSearchMatchFilters(input.filters),
  };
}

export function applySavedSearchMatchSpecToQuery<TQuery extends SavedSearchMatchQueryLike<TQuery>>(
  query: TQuery,
  spec: SavedSearchMatchQuerySpec
): TQuery {
  let next = query.gt("created_at", spec.sinceIso);

  const { filters } = spec;
  if (filters.city) {
    next = next.ilike("city", `%${filters.city}%`);
  }
  if (filters.neighbourhood) {
    next = next.ilike("neighbourhood", `%${filters.neighbourhood}%`);
  }
  if (filters.country_code) {
    next = next.eq("country_code", filters.country_code);
  }
  if (filters.minPrice !== null) {
    next = next.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== null) {
    next = next.lte("price", filters.maxPrice);
  }
  if (filters.bedrooms !== null) {
    if (filters.bedroomsMode === "minimum") {
      next = next.gte("bedrooms", filters.bedrooms);
    } else {
      next = next.eq("bedrooms", filters.bedrooms);
    }
  }
  if (filters.listingIntent) {
    const listingIntents = mapSearchFilterToListingIntents(filters.listingIntent);
    if (listingIntents.length === 1) {
      next = next.eq("listing_intent", listingIntents[0]);
    } else if (listingIntents.length > 1) {
      next = next.in("listing_intent", listingIntents);
    }
  }
  if (filters.rentalType) {
    next = next.eq("rental_type", filters.rentalType);
  }

  return next;
}

export function getSavedSearchBaselineIso(search: SavedSearchLike): string {
  const candidates = [search.last_checked_at, search.last_notified_at, search.created_at]
    .filter((value): value is string => !!value)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  const latest = candidates.length ? Math.max(...candidates) : Date.now();
  return new Date(latest).toISOString();
}

export function toParsedSearchFilters(
  filters: Record<string, unknown>
): ParsedSearchFilters {
  const parsed = parseSavedSearchMatchFilters(filters);
  return {
    city: parsed.city,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    currency: null,
    bedrooms: parsed.bedrooms,
    bedroomsMode: parsed.bedroomsMode,
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: parsed.listingIntent ?? "all",
    rentalType: parsed.rentalType,
    furnished: null,
    amenities: [],
  };
}
