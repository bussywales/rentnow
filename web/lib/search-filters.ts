import type { ParsedSearchFilters, RentalType } from "@/lib/types";

export type SearchParamRecord = Record<string, string | string[] | undefined>;

type FilterChip = {
  label: string;
  value: string;
};

function firstValue(value: string | string[] | undefined | null) {
  if (Array.isArray(value)) return value[0] ?? null;
  if (value === undefined) return null;
  return value ?? null;
}

function parseNumber(value: string | string[] | undefined | null): number | null {
  const raw = firstValue(value);
  if (raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseBoolean(value: string | string[] | undefined | null): boolean | null {
  const raw = firstValue(value);
  if (raw === null || raw === "") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function parseAmenities(value: string | string[] | undefined | null): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseFiltersFromParams(params: SearchParamRecord): ParsedSearchFilters {
  const rentalType = firstValue(params.rentalType);
  return {
    city: firstValue(params.city),
    minPrice: parseNumber(params.minPrice),
    maxPrice: parseNumber(params.maxPrice),
    currency: firstValue(params.currency),
    bedrooms: parseNumber(params.bedrooms),
    rentalType:
      rentalType === "short_let" || rentalType === "long_term"
        ? (rentalType as RentalType)
        : null,
    furnished: parseBoolean(params.furnished),
    amenities: parseAmenities(params.amenities),
  };
}

export function parseFiltersFromSearchParams(
  searchParams: URLSearchParams
): ParsedSearchFilters {
  const amenities = searchParams.getAll("amenities");
  return parseFiltersFromParams({
    city: searchParams.get("city") ?? undefined,
    minPrice: searchParams.get("minPrice") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
    currency: searchParams.get("currency") ?? undefined,
    bedrooms: searchParams.get("bedrooms") ?? undefined,
    rentalType: searchParams.get("rentalType") ?? undefined,
    furnished: searchParams.get("furnished") ?? undefined,
    amenities: amenities.length ? amenities : searchParams.get("amenities") ?? undefined,
  });
}

export function filtersToSearchParams(filters: ParsedSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.currency) params.set("currency", filters.currency);
  if (filters.bedrooms !== null) params.set("bedrooms", String(filters.bedrooms));
  if (filters.rentalType) params.set("rentalType", filters.rentalType);
  if (filters.furnished !== null) params.set("furnished", String(filters.furnished));
  if (filters.amenities.length) {
    params.set("amenities", filters.amenities.join(","));
  }
  return params;
}

export function filtersToChips(filters: ParsedSearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.city) chips.push({ label: "City", value: filters.city });
  if (filters.bedrooms !== null) {
    chips.push({ label: "Bedrooms", value: String(filters.bedrooms) });
  }
  if (filters.rentalType) {
    chips.push({
      label: "Rental type",
      value: filters.rentalType === "short_let" ? "Short-let" : "Long-term",
    });
  }
  if (filters.furnished !== null) {
    chips.push({
      label: "Furnished",
      value: filters.furnished ? "Yes" : "No",
    });
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const range = [
      filters.minPrice !== null ? filters.minPrice : null,
      filters.maxPrice !== null ? filters.maxPrice : null,
    ];
    const label = range
      .map((value) => (value !== null ? value.toString() : "Any"))
      .join(" - ");
    const currency = filters.currency ? ` ${filters.currency}` : "";
    chips.push({ label: "Price", value: `${label}${currency}` });
  }
  if (filters.amenities.length) {
    chips.push({
      label: "Amenities",
      value: filters.amenities.join(", "),
    });
  }
  return chips;
}

export function parseFiltersFromSavedSearch(params: Record<string, unknown>): ParsedSearchFilters {
  const city = typeof params.city === "string" ? params.city : null;
  const minPrice =
    typeof params.minPrice === "number"
      ? params.minPrice
      : params.minPrice
      ? Number(params.minPrice)
      : null;
  const maxPrice =
    typeof params.maxPrice === "number"
      ? params.maxPrice
      : params.maxPrice
      ? Number(params.maxPrice)
      : null;
  const currency = typeof params.currency === "string" ? params.currency : null;
  const bedrooms =
    typeof params.bedrooms === "number"
      ? params.bedrooms
      : params.bedrooms
      ? Number(params.bedrooms)
      : null;
  const rentalType =
    params.rentalType === "short_let" || params.rentalType === "long_term"
      ? (params.rentalType as RentalType)
      : null;
  const furnished =
    params.furnished === true || params.furnished === false
      ? params.furnished
      : params.furnished === "true"
      ? true
      : params.furnished === "false"
      ? false
      : null;
  const amenities = Array.isArray(params.amenities)
    ? params.amenities.filter((item): item is string => typeof item === "string")
    : typeof params.amenities === "string"
    ? params.amenities.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    city,
    minPrice,
    maxPrice,
    currency,
    bedrooms,
    rentalType,
    furnished,
    amenities,
  };
}

export function propertyMatchesFilters(property: {
  city: string;
  price: number;
  currency: string;
  bedrooms: number;
  rental_type: RentalType;
  furnished: boolean;
  amenities?: string[] | null;
}, filters: ParsedSearchFilters): boolean {
  if (filters.city) {
    const cityMatch = property.city.toLowerCase().includes(filters.city.toLowerCase());
    if (!cityMatch) return false;
  }
  if (filters.minPrice !== null && property.price < filters.minPrice) return false;
  if (filters.maxPrice !== null && property.price > filters.maxPrice) return false;
  if (filters.currency && property.currency.toLowerCase() !== filters.currency.toLowerCase()) {
    return false;
  }
  if (filters.bedrooms !== null && property.bedrooms < filters.bedrooms) return false;
  if (filters.rentalType && property.rental_type !== filters.rentalType) return false;
  if (filters.furnished !== null && property.furnished !== filters.furnished) return false;
  if (filters.amenities.length) {
    const available = new Set((property.amenities || []).map((item) => item.toLowerCase()));
    const needsAll = filters.amenities.every((item) => available.has(item.toLowerCase()));
    if (!needsAll) return false;
  }
  return true;
}
