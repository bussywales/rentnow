import { shouldShowSavedSearchNav } from "@/lib/role-access";
import type { RentalType, UserRole } from "@/lib/types";

const PRICE_FORMATTER = new Intl.NumberFormat("en-US");

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

export function formatCadence(rentalType: RentalType): string {
  return rentalType === "short_let" ? "night" : "month";
}

export function formatPriceValue(currency: string, price: number): string {
  const safeCurrency = currency?.trim() || "USD";
  const safePrice = Number.isFinite(price) ? price : 0;
  return `${safeCurrency} ${PRICE_FORMATTER.format(safePrice)}`;
}

export function formatPriceLabel(
  currency: string,
  price: number,
  rentalType: RentalType
): string {
  return `${formatPriceValue(currency, price)} / ${formatCadence(rentalType)}`;
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
  if (shouldShowSavedSearchNav(input.role)) {
    ctas.push({
      label: "Saved searches",
      href: "/dashboard/saved-searches",
      kind: "link",
    });
  }
  return ctas;
}
