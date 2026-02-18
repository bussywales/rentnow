import { isShortletProperty, resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import type { Property } from "@/lib/types";

export type ShortletSearchSort = "recommended" | "price_low" | "price_high" | "newest";

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
};

export type ShortletSearchFilters = {
  q: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
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
  if (value === "price_low") return "price_low";
  if (value === "price_high") return "price_high";
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

export function parseShortletSearchBounds(value: string | null): ShortletSearchBounds | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [north, south, east, west] = parts;
  if (north <= south || east <= west) return null;
  if (north > 90 || south < -90 || east > 180 || west < -180) return null;
  return { north, south, east, west };
}

export function serializeShortletSearchBounds(bounds: ShortletSearchBounds | null): string | null {
  if (!bounds) return null;
  return [bounds.north, bounds.south, bounds.east, bounds.west].join(",");
}

export function parseShortletSearchFilters(params: URLSearchParams): ShortletSearchFilters {
  return {
    q: normalizeQ(params.get("q")),
    checkIn: parseDate(params.get("checkIn")),
    checkOut: parseDate(params.get("checkOut")),
    guests: parsePositiveInt(params.get("guests"), 1),
    bounds: parseShortletSearchBounds(params.get("bounds")),
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

export function sortShortletSearchResults(
  rows: Property[],
  sort: ShortletSearchSort
): Property[] {
  const withNightly = rows.map((property, index) => ({
    property,
    index,
    nightly: resolveShortletNightlyPriceMinor(property),
    createdAtMs: Date.parse(String(property.created_at || "")) || 0,
  }));

  if (sort === "price_low") {
    return withNightly
      .sort((left, right) => {
        const leftPrice = left.nightly ?? Number.MAX_SAFE_INTEGER;
        const rightPrice = right.nightly ?? Number.MAX_SAFE_INTEGER;
        if (leftPrice !== rightPrice) return leftPrice - rightPrice;
        return right.createdAtMs - left.createdAtMs;
      })
      .map((entry) => entry.property);
  }

  if (sort === "price_high") {
    return withNightly
      .sort((left, right) => {
        const leftPrice = left.nightly ?? 0;
        const rightPrice = right.nightly ?? 0;
        if (leftPrice !== rightPrice) return rightPrice - leftPrice;
        return right.createdAtMs - left.createdAtMs;
      })
      .map((entry) => entry.property);
  }

  if (sort === "newest") {
    return withNightly
      .sort((left, right) => right.createdAtMs - left.createdAtMs)
      .map((entry) => entry.property);
  }

  return withNightly
    .sort((left, right) => {
      const leftMode = resolveShortletBookingMode(left.property);
      const rightMode = resolveShortletBookingMode(right.property);
      if (leftMode !== rightMode) {
        if (leftMode === "instant") return -1;
        if (rightMode === "instant") return 1;
      }
      const leftPrice = left.nightly ?? Number.MAX_SAFE_INTEGER;
      const rightPrice = right.nightly ?? Number.MAX_SAFE_INTEGER;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
      if (left.createdAtMs !== right.createdAtMs) return right.createdAtMs - left.createdAtMs;
      return left.index - right.index;
    })
    .map((entry) => entry.property);
}

export function filterToShortletListings(rows: Property[]): Property[] {
  return rows.filter((row) => isShortletProperty(row));
}

export function parseSearchView(value: string | null): "list" | "map" {
  return value === "map" ? "map" : "list";
}

