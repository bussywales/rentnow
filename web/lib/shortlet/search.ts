import { isShortletProperty, resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import type { Property } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";
import { resolvePropertyImageUrl } from "@/lib/properties/image-url";
import {
  formatShortletCancellationLabel,
  isFreeCancellationPolicy,
  resolveShortletCancellationPolicy,
  type ShortletCancellationPolicy,
} from "@/lib/shortlet/cancellation";

export type ShortletSearchSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest";

export type ShortletSearchBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ShortletSearchTrustFilters = {
  powerBackup: boolean;
  waterBorehole: boolean;
  security: boolean;
  wifi: boolean;
  verifiedHost: boolean;
};

export type ShortletSearchProviderFilters = {
  bookingMode: "instant" | "request" | null;
  freeCancellation: boolean;
};

export type ShortletSearchFilters = {
  where: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  marketCountry: string;
  bounds: ShortletSearchBounds | null;
  sort: ShortletSearchSort;
  trust: ShortletSearchTrustFilters;
  provider: ShortletSearchProviderFilters;
  page: number;
  pageSize: number;
};

export type ShortletOverlapRow = {
  property_id: string;
  start: string;
  end: string;
};

type ShortletSearchImageRow = {
  id?: string | null;
  image_url?: string | null;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
};

export type ShortletSearchPropertyRow = Property & {
  property_images?: ShortletSearchImageRow[] | null;
};

export type ShortletSearchResultItem = Property & {
  primaryImageUrl: string | null;
  coverImageUrl: string | null;
  imageCount: number;
  imageUrls: string[];
  hasCoords: boolean;
  cancellationPolicy: ShortletCancellationPolicy;
  cancellationLabel: string;
  freeCancellation: boolean;
};

type ShortletSearchSortContext = {
  verifiedHostIds?: ReadonlySet<string>;
  recommendedCenter?: { latitude: number; longitude: number } | null;
  applyNigeriaBoost?: boolean;
  hasDateRange?: boolean;
};

const POWER_BACKUP_TOKENS = [
  "generator",
  "gen",
  "inverter",
  "backup power",
  "power backup",
];

const WATER_BOREHOLE_TOKENS = ["borehole", "water"];

const SECURITY_TOKENS = ["security", "guard", "gated", "gated estate", "cctv"];

const WIFI_TOKENS = ["wifi", "wi-fi", "internet", "fibre", "fiber"];

const COUNTRY_ALIAS_TO_CODE: Record<string, string> = {
  ng: "NG",
  nigeria: "NG",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  ke: "KE",
  kenya: "KE",
};

const MARKET_DEFAULT_CURRENCIES: Record<string, string[]> = {
  NG: ["NGN"],
  GB: ["GBP"],
  KE: ["KES"],
  US: ["USD"],
};

const SHORTLET_IMAGE_PLACEHOLDER_PATTERNS = [
  "images.unsplash.com/photo-1505691938895-1758d7feb511",
  "placeholder",
  "placehold.co",
  "via.placeholder.com",
];

function asBoolean(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizeQ(value: string | null): string | null {
  const normalized = String(value || "").trim();
  return normalized.length ? normalized : null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function parseSort(value: string | null): ShortletSearchSort {
  if (value === "price_low" || value === "price_asc") return "price_asc";
  if (value === "price_high" || value === "price_desc") return "price_desc";
  if (value === "rating") return "rating";
  if (value === "newest") return "newest";
  return "recommended";
}

function parseBookingMode(value: string | null): "instant" | "request" | null {
  if (value === "instant" || value === "request") return value;
  return null;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function normalizeCountryCodeOrAlias(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  const alias = COUNTRY_ALIAS_TO_CODE[key];
  if (alias) return alias;
  const upper = normalized.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return null;
}

function parseMarketCountry(params: URLSearchParams): string {
  return (
    normalizeCountryCodeOrAlias(params.get("market")) ??
    normalizeCountryCodeOrAlias(params.get("country")) ??
    "NG"
  );
}

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "₦") return "NGN";
  return normalized;
}

function parseTimestampMs(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveShortletListingRating(property: Property): number | null {
  const record = property as unknown as Record<string, unknown>;
  const candidates = [
    record.average_rating,
    record.rating,
    record.review_rating,
    record.host_rating,
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

export function isShortletPlaceholderImageUrl(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return SHORTLET_IMAGE_PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export type ShortletRecommendedScoreInput = {
  property: Property;
  verifiedHost: boolean;
  hasDateRange: boolean;
  applyNigeriaBoost: boolean;
  primaryImageUrl: string | null;
  recommendedCenter?: { latitude: number; longitude: number } | null;
};

export function scoreShortletRecommendedListing(input: ShortletRecommendedScoreInput): number {
  let score = 0;
  const bookingMode = resolveShortletBookingMode(input.property);
  const nightlyMinor = resolveShortletNightlyPriceMinor(input.property);
  const hasPrice = typeof nightlyMinor === "number" && nightlyMinor > 0;
  const hasQualityImage = !isShortletPlaceholderImageUrl(input.primaryImageUrl);
  const countryCode = resolvePropertyCountryCode(input.property);

  if (input.applyNigeriaBoost && countryCode === "NG") score += 80;
  if (input.verifiedHost) score += 320;
  if (hasQualityImage) score += 220;
  if (input.hasDateRange) score += 140;
  if (bookingMode === "instant") score += 80;
  if (bookingMode === "request") score += 30;
  if (hasPrice) score += 60;

  if (input.recommendedCenter) {
    if (typeof input.property.latitude === "number" && typeof input.property.longitude === "number") {
      const latDiff = input.property.latitude - input.recommendedCenter.latitude;
      const lngDiff = input.property.longitude - input.recommendedCenter.longitude;
      const distance = Math.hypot(latDiff, lngDiff);
      score += Math.max(0, 40 - distance * 240);
    }
  }

  return score;
}

export function parseShortletSearchBounds(value: string | null): ShortletSearchBounds | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [north, south, east, west] = parts;
  if (north <= south || east <= west) return null;
  if (north > 90 || south < -90 || east > 180 || west < -180) return null;
  return { north, south, east, west };
}

export function parseShortletSearchBbox(value: string | null): ShortletSearchBounds | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (maxLat <= minLat || maxLng <= minLng) return null;
  if (maxLat > 90 || minLat < -90 || maxLng > 180 || minLng < -180) return null;
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
  };
}

export function serializeShortletSearchBounds(bounds: ShortletSearchBounds | null): string | null {
  if (!bounds) return null;
  return [bounds.north, bounds.south, bounds.east, bounds.west].join(",");
}

export function serializeShortletSearchBbox(bounds: ShortletSearchBounds | null): string | null {
  if (!bounds) return null;
  return [bounds.west, bounds.south, bounds.east, bounds.north].join(",");
}

export function parseShortletSearchFilters(params: URLSearchParams): ShortletSearchFilters {
  const where = normalizeQ(params.get("where") ?? params.get("q"));
  const bounds = parseShortletSearchBbox(params.get("bbox")) ?? parseShortletSearchBounds(params.get("bounds"));
  return {
    where,
    checkIn: parseDate(params.get("checkIn")),
    checkOut: parseDate(params.get("checkOut")),
    guests: parsePositiveInt(params.get("guests"), 1),
    marketCountry: parseMarketCountry(params),
    bounds,
    sort: parseSort(params.get("sort")),
    trust: {
      powerBackup: asBoolean(params.get("powerBackup")),
      waterBorehole: asBoolean(params.get("waterBorehole")),
      security: asBoolean(params.get("security")),
      wifi: asBoolean(params.get("wifi")),
      verifiedHost: asBoolean(params.get("verifiedHost")),
    },
    provider: {
      bookingMode: parseBookingMode(params.get("bookingMode")),
      freeCancellation: asBoolean(params.get("freeCancellation")),
    },
    page: Math.max(1, parsePositiveInt(params.get("page"), 1)),
    pageSize: Math.min(48, Math.max(1, parsePositiveInt(params.get("pageSize"), 24))),
  };
}

function normalizeAmenities(amenities: string[] | null | undefined): string[] {
  return (amenities || [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function includesAnyAmenity(amenities: string[], tokens: ReadonlyArray<string>): boolean {
  if (!amenities.length) return false;
  return tokens.some((token) => amenities.some((amenity) => amenity.includes(token)));
}

export function isWithinBounds(property: Property, bounds: ShortletSearchBounds | null): boolean {
  if (!bounds) return true;
  if (typeof property.latitude !== "number" || typeof property.longitude !== "number") return false;
  return (
    property.latitude <= bounds.north &&
    property.latitude >= bounds.south &&
    property.longitude <= bounds.east &&
    property.longitude >= bounds.west
  );
}

export function matchesShortletSearchQuery(property: Property, q: string | null): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    property.title,
    property.city,
    property.neighbourhood,
    property.address,
    property.location_label,
    property.admin_area_1,
    property.admin_area_2,
    property.state_region,
    property.country,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(needle);
}

export function matchesShortletDestination(property: Property, where: string | null): boolean {
  if (!where) return true;
  const needle = where.toLowerCase();
  const haystack = [
    property.city,
    property.neighbourhood,
    property.address,
    property.location_label,
    property.admin_area_1,
    property.admin_area_2,
    property.state_region,
    property.country,
    property.country_code,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(needle);
}

function resolvePropertyCountryCode(property: Pick<Property, "country_code" | "country">): string | null {
  return (
    normalizeCountryCodeOrAlias(property.country_code ?? null) ??
    normalizeCountryCodeOrAlias(property.country ?? null)
  );
}

export function matchesShortletMarketCountry(
  property: Pick<Property, "country_code" | "country" | "currency">,
  marketCountry: string
): boolean {
  const normalizedMarketCountry = normalizeCountryCodeOrAlias(marketCountry);
  if (!normalizedMarketCountry) return true;
  const propertyCountryCode = resolvePropertyCountryCode(property);
  if (propertyCountryCode) {
    return propertyCountryCode === normalizedMarketCountry;
  }

  const propertyCurrency = normalizeCurrencyCode(property.currency);
  if (!propertyCurrency) return false;
  const expectedCurrencies = MARKET_DEFAULT_CURRENCIES[normalizedMarketCountry] ?? [];
  return expectedCurrencies.includes(propertyCurrency);
}

export function filterShortletListingsByMarket(rows: Property[], marketCountry: string): Property[] {
  return rows.filter((row) => matchesShortletMarketCountry(row, marketCountry));
}

export function isNigeriaDestinationQuery(where: string | null): boolean {
  const normalized = String(where || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "ng" || normalized.includes("nigeria");
}

export function matchesTrustFilters(input: {
  property: Property;
  trustFilters: ShortletSearchTrustFilters;
  verifiedHostIds: ReadonlySet<string>;
}): boolean {
  const amenities = normalizeAmenities(input.property.amenities);
  if (input.trustFilters.powerBackup && !includesAnyAmenity(amenities, POWER_BACKUP_TOKENS)) {
    return false;
  }
  if (input.trustFilters.waterBorehole && !includesAnyAmenity(amenities, WATER_BOREHOLE_TOKENS)) {
    return false;
  }
  if (input.trustFilters.security && !includesAnyAmenity(amenities, SECURITY_TOKENS)) {
    return false;
  }
  if (input.trustFilters.wifi && !includesAnyAmenity(amenities, WIFI_TOKENS)) {
    return false;
  }
  if (input.trustFilters.verifiedHost && !input.verifiedHostIds.has(input.property.owner_id)) {
    return false;
  }
  return true;
}

export function matchesFreeCancellationFilter(input: {
  property: Property;
  freeCancellationOnly: boolean;
}): boolean {
  if (!input.freeCancellationOnly) return true;
  const policy = resolveShortletCancellationPolicy({
    shortlet_settings: input.property.shortlet_settings ?? null,
  });
  return isFreeCancellationPolicy(policy);
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

export function unavailablePropertyIdsForDateRange(input: {
  checkIn: string;
  checkOut: string;
  bookedOverlaps: ReadonlyArray<ShortletOverlapRow>;
  blockedOverlaps: ReadonlyArray<ShortletOverlapRow>;
}): Set<string> {
  const unavailable = new Set<string>();
  for (const row of input.bookedOverlaps) {
    if (overlaps(row.start, row.end, input.checkIn, input.checkOut)) {
      unavailable.add(row.property_id);
    }
  }
  for (const row of input.blockedOverlaps) {
    if (overlaps(row.start, row.end, input.checkIn, input.checkOut)) {
      unavailable.add(row.property_id);
    }
  }
  return unavailable;
}

export function filterShortletRowsByDateAvailability(input: {
  rows: Property[];
  checkIn: string | null;
  checkOut: string | null;
  bookedOverlaps: ReadonlyArray<ShortletOverlapRow>;
  blockedOverlaps: ReadonlyArray<ShortletOverlapRow>;
}): {
  rows: Property[];
  unavailablePropertyIds: Set<string>;
} {
  if (!input.checkIn || !input.checkOut || input.checkIn >= input.checkOut) {
    return {
      rows: input.rows,
      unavailablePropertyIds: new Set<string>(),
    };
  }

  const unavailablePropertyIds = unavailablePropertyIdsForDateRange({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    bookedOverlaps: input.bookedOverlaps,
    blockedOverlaps: input.blockedOverlaps,
  });

  return {
    rows: input.rows.filter((row) => !unavailablePropertyIds.has(row.id)),
    unavailablePropertyIds,
  };
}

export function sortShortletSearchResults(
  rows: Property[],
  sort: ShortletSearchSort,
  context: ShortletSearchSortContext = {}
): Property[] {
  const hasDateRange = !!context.hasDateRange;
  const withNightly = rows.map((property, index) => ({
    property,
    index,
    nightly: resolveShortletNightlyPriceMinor(property),
    createdAtMs: parseTimestampMs(property.created_at),
    updatedAtMs: parseTimestampMs(property.updated_at),
    rating: resolveShortletListingRating(property),
    verifiedHost: !!context.verifiedHostIds?.has(property.owner_id),
    distanceToCenter: (() => {
      if (!context.recommendedCenter) return Number.POSITIVE_INFINITY;
      const { latitude, longitude } = context.recommendedCenter;
      if (typeof property.latitude !== "number" || typeof property.longitude !== "number") {
        return Number.POSITIVE_INFINITY;
      }
      const latDiff = property.latitude - latitude;
      const lngDiff = property.longitude - longitude;
      return Math.hypot(latDiff, lngDiff);
    })(),
    bookingMode: resolveShortletBookingMode(property),
    hasPrice: (() => {
      const nightly = resolveShortletNightlyPriceMinor(property);
      return typeof nightly === "number" && nightly > 0;
    })(),
    primaryImageUrl: resolveShortletPrimaryImageUrl(property as ShortletSearchPropertyRow),
    recommendedScore: 0,
  }));
  for (const row of withNightly) {
    row.recommendedScore = scoreShortletRecommendedListing({
      property: row.property,
      verifiedHost: row.verifiedHost,
      hasDateRange,
      applyNigeriaBoost: !!context.applyNigeriaBoost,
      primaryImageUrl: row.primaryImageUrl,
      recommendedCenter: context.recommendedCenter,
    });
  }

  const stableTieBreak = (
    left: (typeof withNightly)[number],
    right: (typeof withNightly)[number]
  ): number => {
    if (left.updatedAtMs !== right.updatedAtMs) return right.updatedAtMs - left.updatedAtMs;
    if (left.createdAtMs !== right.createdAtMs) return right.createdAtMs - left.createdAtMs;
    if (left.property.id !== right.property.id) {
      return String(left.property.id).localeCompare(String(right.property.id));
    }
    return left.index - right.index;
  };

  if (sort === "price_asc") {
    return withNightly
      .sort((left, right) => {
        const leftPrice = left.nightly ?? Number.MAX_SAFE_INTEGER;
        const rightPrice = right.nightly ?? Number.MAX_SAFE_INTEGER;
        if (leftPrice !== rightPrice) return leftPrice - rightPrice;
        return stableTieBreak(left, right);
      })
      .map((entry) => entry.property);
  }

  if (sort === "price_desc") {
    return withNightly
      .sort((left, right) => {
        const leftPrice = left.nightly ?? 0;
        const rightPrice = right.nightly ?? 0;
        if (leftPrice !== rightPrice) return rightPrice - leftPrice;
        return stableTieBreak(left, right);
      })
      .map((entry) => entry.property);
  }

  if (sort === "newest") {
    return withNightly
      .sort((left, right) => {
        if (left.createdAtMs !== right.createdAtMs) return right.createdAtMs - left.createdAtMs;
        return stableTieBreak(left, right);
      })
      .map((entry) => entry.property);
  }

  if (sort === "rating") {
    return withNightly
      .sort((left, right) => {
        const leftRating = left.rating ?? -1;
        const rightRating = right.rating ?? -1;
        if (leftRating !== rightRating) return rightRating - leftRating;
        return stableTieBreak(left, right);
      })
      .map((entry) => entry.property);
  }

  return withNightly
    .sort((left, right) => {
      if (left.recommendedScore !== right.recommendedScore) {
        return right.recommendedScore - left.recommendedScore;
      }
      if (left.hasPrice !== right.hasPrice) return left.hasPrice ? -1 : 1;
      if (left.bookingMode !== right.bookingMode) {
        if (left.bookingMode === "instant") return -1;
        if (right.bookingMode === "instant") return 1;
      }
      if (left.distanceToCenter !== right.distanceToCenter) {
        return left.distanceToCenter - right.distanceToCenter;
      }
      return stableTieBreak(left, right);
    })
    .map((entry) => entry.property);
}

export function filterToShortletListings(rows: Property[]): Property[] {
  return rows.filter((row) => isShortletProperty(row));
}

export function parseSearchView(value: string | null): "list" | "map" {
  return value === "map" ? "map" : "list";
}

function normalizeImageRows(
  rows: Array<{
    id?: string | null;
    image_url?: string | null;
    position?: number | null;
    created_at?: string | null;
    width?: number | null;
    height?: number | null;
    bytes?: number | null;
    format?: string | null;
    storage_path?: string | null;
    original_storage_path?: string | null;
    thumb_storage_path?: string | null;
    card_storage_path?: string | null;
    hero_storage_path?: string | null;
  }>
) {
  return rows
    .map((img) => ({
      id: String(img.id || img.image_url || ""),
      image_url: String(img.image_url || ""),
      position: typeof img.position === "number" ? img.position : null,
      created_at: img.created_at ?? undefined,
      width: typeof img.width === "number" ? img.width : null,
      height: typeof img.height === "number" ? img.height : null,
      bytes: typeof img.bytes === "number" ? img.bytes : null,
      format: img.format ?? null,
      storage_path: img.storage_path ?? null,
      original_storage_path: img.original_storage_path ?? null,
      thumb_storage_path: img.thumb_storage_path ?? null,
      card_storage_path: img.card_storage_path ?? null,
      hero_storage_path: img.hero_storage_path ?? null,
    }))
    .filter((img) => img.id && img.image_url);
}

function extractImageRowsFromProperty(
  row: ShortletSearchPropertyRow
): Array<{
  id?: string | null;
  image_url?: string | null;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
}> {
  const fromPropertyImages = (row.property_images ?? []) as Array<{
    id?: string | null;
    image_url?: string | null;
    position?: number | null;
    created_at?: string | null;
    width?: number | null;
    height?: number | null;
    bytes?: number | null;
    format?: string | null;
    storage_path?: string | null;
    original_storage_path?: string | null;
    thumb_storage_path?: string | null;
    card_storage_path?: string | null;
    hero_storage_path?: string | null;
  }>;
  const fromImages = ((row.images as Property["images"] | undefined) ?? []).map((img) => ({
    id: img.id,
    image_url: img.image_url,
    position: img.position ?? null,
    created_at: img.created_at ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
    bytes: img.bytes ?? null,
    format: img.format ?? null,
    storage_path: img.storage_path ?? null,
    original_storage_path: img.original_storage_path ?? null,
    thumb_storage_path: img.thumb_storage_path ?? null,
    card_storage_path: img.card_storage_path ?? null,
    hero_storage_path: img.hero_storage_path ?? null,
  }));
  return [...fromPropertyImages, ...fromImages];
}

export function resolveShortletPrimaryImageUrl(row: ShortletSearchPropertyRow): string | null {
  const rawRows = extractImageRowsFromProperty(row);
  const ordered = orderImagesWithCover(row.cover_image_url, normalizeImageRows(rawRows));
  const firstImage = ordered[0];
  if (firstImage) {
    return resolvePropertyImageUrl(firstImage, "card") ?? firstImage.image_url;
  }
  return row.cover_image_url || null;
}

export function mapShortletSearchRowsToResultItems(
  rows: ShortletSearchPropertyRow[]
): ShortletSearchResultItem[] {
  return rows.map((row) => {
    const rawRows = extractImageRowsFromProperty(row);
    const normalizedImages = normalizeImageRows(rawRows);
    const primaryImageUrl = resolveShortletPrimaryImageUrl(row);
    const orderedImages = orderImagesWithCover(primaryImageUrl, normalizedImages);
    const coverImageUrl = primaryImageUrl;
    const imageUrls = orderedImages
      .slice(0, 5)
      .map((img) => resolvePropertyImageUrl(img, "card") ?? img.image_url);
    const imageCount = orderedImages.length;
    const hasCoords =
      typeof row.latitude === "number" &&
      Number.isFinite(row.latitude) &&
      typeof row.longitude === "number" &&
      Number.isFinite(row.longitude);
    const cancellationPolicy = resolveShortletCancellationPolicy({
      shortlet_settings: row.shortlet_settings ?? null,
    });
    const cancellationLabel = formatShortletCancellationLabel(cancellationPolicy);
    const freeCancellation = isFreeCancellationPolicy(cancellationPolicy);

    const rest: Property = { ...row };
    delete (rest as Property & { property_images?: ShortletSearchImageRow[] }).property_images;
    return {
      ...rest,
      cover_image_url: coverImageUrl,
      images: orderedImages,
      primaryImageUrl,
      coverImageUrl,
      imageCount,
      imageUrls,
      hasCoords,
      cancellationPolicy,
      cancellationLabel,
      freeCancellation,
    };
  });
}
