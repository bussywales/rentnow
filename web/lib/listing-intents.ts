import type { ListingIntent } from "@/lib/types";

export const LISTING_INTENT_LABELS_PUBLIC: Record<ListingIntent, string> = {
  rent: "Rent",
  buy: "Buy",
};

export const LISTING_INTENT_LABELS_HOST: Record<ListingIntent, string> = {
  rent: "Rent/Lease",
  buy: "Sell (For Sale)",
};

export function getHostListingIntentOptions() {
  return (Object.keys(LISTING_INTENT_LABELS_HOST) as ListingIntent[]).map((value) => ({
    value,
    label: LISTING_INTENT_LABELS_HOST[value],
  }));
}

export function getPublicListingIntentLabel(intent: ListingIntent) {
  return LISTING_INTENT_LABELS_PUBLIC[intent];
}

export function isSaleIntent(intent?: ListingIntent | null): boolean {
  return intent === "buy";
}

export function isRentIntent(intent?: ListingIntent | null): boolean {
  return intent !== "buy";
}
