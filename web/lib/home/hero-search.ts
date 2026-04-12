import { buildPropertiesCategoryParams } from "@/lib/properties/browse-categories";
import type { ListingType } from "@/lib/types";

export type HeroSearchMode = "rent" | "buy" | "shortlet";

export type HeroSearchFieldValue = {
  location?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  bedrooms?: string | null;
  propertyType?: string | null;
  marketCountry?: string | null;
  source?: string | null;
};

export type HeroSearchPropertyTypeOption = {
  value: ListingType;
  label: string;
};

const HERO_PROPERTY_TYPE_LABELS: Record<ListingType, string> = {
  apartment: "Apartment",
  condo: "Condo",
  house: "House",
  duplex: "Duplex",
  bungalow: "Bungalow",
  studio: "Studio",
  room: "Room",
  student: "Student housing",
  hostel: "Hostel",
  shop: "Shop",
  office: "Office",
  land: "Land",
};

const HERO_PROPERTY_TYPES_BY_MODE: Record<HeroSearchMode, ListingType[]> = {
  rent: [
    "apartment",
    "condo",
    "house",
    "duplex",
    "bungalow",
    "studio",
    "room",
    "student",
    "hostel",
    "shop",
    "office",
  ],
  buy: ["apartment", "condo", "house", "duplex", "bungalow", "shop", "office", "land"],
  shortlet: ["apartment", "condo", "house", "duplex", "bungalow", "studio", "room"],
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function parsePositiveIntString(value: string | null | undefined): string | null {
  const raw = trimOrNull(value);
  if (!raw) return null;
  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return String(Math.trunc(numeric));
}

function parsePropertyType(mode: HeroSearchMode, value: string | null | undefined): ListingType | null {
  const raw = trimOrNull(value);
  if (!raw) return null;
  const allowed = HERO_PROPERTY_TYPES_BY_MODE[mode];
  return allowed.includes(raw as ListingType) ? (raw as ListingType) : null;
}

export function getHeroSearchPropertyTypeOptions(mode: HeroSearchMode): HeroSearchPropertyTypeOption[] {
  return HERO_PROPERTY_TYPES_BY_MODE[mode].map((value) => ({
    value,
    label: HERO_PROPERTY_TYPE_LABELS[value],
  }));
}

export function buildHeroSearchHref(mode: HeroSearchMode, values: HeroSearchFieldValue): string {
  const location = trimOrNull(values.location);
  const minPrice = parsePositiveIntString(values.minPrice);
  const maxPrice = parsePositiveIntString(values.maxPrice);
  const bedrooms = parsePositiveIntString(values.bedrooms);
  const propertyType = parsePropertyType(mode, values.propertyType);
  const source = trimOrNull(values.source);

  if (mode === "shortlet") {
    const params = new URLSearchParams();
    if (location) params.set("where", location);
    if (values.marketCountry) params.set("market", values.marketCountry);
    if (bedrooms) params.set("guests", bedrooms);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (propertyType) params.set("propertyType", propertyType);
    if (source) params.set("source", source);
    const query = params.toString();
    return query ? `/shortlets?${query}` : "/shortlets";
  }

  const category = mode === "buy" ? "buy" : "rent";
  const params = buildPropertiesCategoryParams(new URLSearchParams(), category);
  if (location) params.set("city", location);
  if (minPrice) params.set("minPrice", minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (bedrooms) params.set("bedrooms", bedrooms);
  if (propertyType) params.set("propertyType", propertyType);
  if (mode === "rent") params.set("rentalType", "long_term");
  if (source) params.set("source", source);

  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}
