import type { ListingIntent } from "@/lib/types";

export const LISTING_INTENT_LABELS_PUBLIC: Record<ListingIntent, string> = {
  rent_lease: "Rent/Lease",
  sale: "For sale",
  shortlet: "Shortlet",
  off_plan: "Off-plan",
  rent: "Rent/Lease",
  buy: "For sale",
};

export const LISTING_INTENT_LABELS_HOST: Record<ListingIntent, string> = {
  rent_lease: "Rent/Lease",
  sale: "Sell (For sale)",
  shortlet: "Shortlet (Bookable stay)",
  off_plan: "Off-plan",
  rent: "Rent/Lease",
  buy: "Sell (For sale)",
};

export function getHostListingIntentOptions() {
  return (["rent_lease", "sale", "shortlet", "off_plan"] as ListingIntent[]).map((value) => ({
    value,
    label: LISTING_INTENT_LABELS_HOST[value],
  }));
}

export function getPublicListingIntentLabel(intent: ListingIntent) {
  return LISTING_INTENT_LABELS_PUBLIC[intent];
}

export function isSaleIntent(intent?: ListingIntent | null): boolean {
  return intent === "sale" || intent === "buy";
}

export function isRentIntent(intent?: ListingIntent | null): boolean {
  return intent === "rent_lease" || intent === "rent";
}

export function isShortletIntent(intent?: ListingIntent | null): boolean {
  return intent === "shortlet";
}

export function isOffPlanIntent(intent?: ListingIntent | null): boolean {
  return intent === "off_plan";
}

export function normalizeListingIntent(intent?: string | null): ListingIntent | null {
  const normalized = String(intent || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "rent" || normalized === "rent_lease") return "rent_lease";
  if (normalized === "buy" || normalized === "sale") return "sale";
  if (normalized === "shortlet") return "shortlet";
  if (normalized === "off_plan") return "off_plan";
  return null;
}

export function mapIntentForSearchFilter(intent?: ListingIntent | null): "rent" | "buy" | "all" {
  if (!intent) return "all";
  if (isSaleIntent(intent)) return "buy";
  if (isRentIntent(intent)) return "rent";
  return "all";
}

export function mapSearchFilterToListingIntent(
  filter: "rent" | "buy" | "all" | null | undefined
): ListingIntent | null {
  if (filter === "rent") return "rent_lease";
  if (filter === "buy") return "sale";
  return null;
}
