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
