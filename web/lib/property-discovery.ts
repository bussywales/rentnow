import { normalizeCurrency } from "@/lib/currencies";
import { shouldShowSavedSearchNav } from "@/lib/role-access";
import type { ListingType, RentPeriod, RentalType, SizeUnit, UserRole } from "@/lib/types";

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "\u00a3",
  EUR: "\u20ac",
  NGN: "\u20a6",
};

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  apartment: "Apartment",
  house: "House",
  duplex: "Duplex",
  bungalow: "Bungalow",
  studio: "Studio",
  room: "Room",
  shop: "Shop",
  office: "Office",
  land: "Land",
};

const SIZE_UNIT_LABELS: Record<SizeUnit, string> = {
  sqm: "sqm",
  sqft: "sqft",
};

function resolveCurrencyCode(input?: string | null): string {
  const normalized = normalizeCurrency(input);
  if (normalized) return normalized;
  const trimmed = input?.trim().toUpperCase();
  return trimmed || "USD";
}

function resolveCurrencyPrefix(code: string): string {
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export type BrowseEmptyCta = {
  label: string;
  href: string;
  kind: "primary" | "secondary" | "link";
};

export function formatLocationLabel(
  city: string | null | undefined,
  neighbourhood?: string | null
): string {
  const safeCity = city?.trim();
  const safeNeighbourhood = neighbourhood?.trim();
  if (safeNeighbourhood && safeCity) {
    return `${safeNeighbourhood}, ${safeCity}`;
  }
  if (safeNeighbourhood) {
    return safeNeighbourhood;
  }
  return safeCity || "Location unavailable";
}

export function formatCadence(
  rentalType: RentalType,
  rentPeriod?: RentPeriod | null
): string | null {
  if (rentalType === "short_let") return "night";
  if (rentPeriod === "yearly") return "year";
  if (rentPeriod === "monthly") return "month";
  return null;
}

export function formatPriceValue(currency: string, price: number): string {
  const safeCurrency = resolveCurrencyCode(currency);
  const safePrice = Number.isFinite(price) ? price : 0;
  const prefix = resolveCurrencyPrefix(safeCurrency);
  return `${prefix}${PRICE_FORMATTER.format(safePrice)}`;
}

export function formatPriceLabel(
  currency: string,
  price: number,
  rentalType: RentalType,
  rentPeriod?: RentPeriod | null
): string {
  const cadence = formatCadence(rentalType, rentPeriod);
  const base = formatPriceValue(currency, price);
  return cadence ? `${base} / ${cadence}` : base;
}

export function formatListingType(listingType?: ListingType | null): string | null {
  if (!listingType) return null;
  return LISTING_TYPE_LABELS[listingType] || listingType;
}

export function formatSizeLabel(
  sizeValue?: number | null,
  sizeUnit?: SizeUnit | null
): string | null {
  if (!Number.isFinite(sizeValue)) return null;
  const unit = sizeUnit ? SIZE_UNIT_LABELS[sizeUnit] || sizeUnit : "";
  return unit ? `${sizeValue} ${unit}` : `${sizeValue}`;
}

export function getBrowseEmptyStateCtas(input: {
  role: UserRole | null;
  hasFilters: boolean;
}): BrowseEmptyCta[] {
  const ctas: BrowseEmptyCta[] = [];
  if (input.hasFilters) {
    ctas.push({ label: "Clear filters", href: "/properties", kind: "secondary" });
  }
  ctas.push({ label: "Browse all", href: "/properties", kind: "primary" });
  if (shouldShowSavedSearchNav()) {
    ctas.push({
      label: "Saved searches",
      href: "/dashboard/saved-searches",
      kind: "link",
    });
  }
  return ctas;
}
