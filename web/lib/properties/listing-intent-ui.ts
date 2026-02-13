import type { ListingIntentFilter } from "@/lib/types";

export type ListingIntentToggleOption = {
  value: ListingIntentFilter;
  label: string;
};

export const LISTING_INTENT_TOGGLE_OPTIONS: ListingIntentToggleOption[] = [
  { value: "rent", label: "To rent" },
  { value: "buy", label: "For sale" },
  { value: "all", label: "All homes" },
];

export function getIntentModeHint(intent: ListingIntentFilter): string | null {
  if (intent === "rent") {
    return "Showing rentals. Switch to All homes to include for-sale homes.";
  }
  if (intent === "buy") {
    return "Showing for-sale homes. Switch to All homes to include rentals.";
  }
  if (intent === "all") {
    return "Showing all homes across rent and sale listings.";
  }
  return null;
}

export function getIntentSummaryCopy(intent: ListingIntentFilter): string {
  if (intent === "rent") return "Mode: To rent";
  if (intent === "buy") return "Mode: For sale";
  return "Mode: All homes";
}

const BROWSE_FILTER_QUERY_KEYS = [
  "city",
  "minPrice",
  "maxPrice",
  "currency",
  "bedrooms",
  "bedroomsMode",
  "includeSimilarOptions",
  "propertyType",
  "rentalType",
  "furnished",
  "amenities",
  "featured",
  "recent",
  "savedSearchId",
  "source",
  "success",
  "notice",
  "reason",
  "page",
] as const;

export function buildClearFiltersHref(
  pathname: string,
  params: URLSearchParams,
  intent: ListingIntentFilter
): string {
  const next = new URLSearchParams(params.toString());
  BROWSE_FILTER_QUERY_KEYS.forEach((key) => next.delete(key));
  next.set("intent", intent);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export type ListingIntentRecoveryCardCopy = {
  switchIntentLabel: string;
  showAllLabel: string;
};

export function getIntentRecoveryCardCopy(
  currentIntent: ListingIntentFilter
): ListingIntentRecoveryCardCopy | null {
  if (currentIntent === "all") return null;
  if (currentIntent === "rent") {
    return {
      switchIntentLabel: "Switch to For sale",
      showAllLabel: "Show all homes",
    };
  }
  if (currentIntent === "buy") {
    return {
      switchIntentLabel: "Switch to To rent",
      showAllLabel: "Show all homes",
    };
  }
  return null;
}

export type ListingIntentRecoveryOption = {
  intent: ListingIntentFilter;
  label: string;
};

export function buildIntentHref(
  pathname: string,
  params: URLSearchParams,
  intent: ListingIntentFilter
): string {
  const next = new URLSearchParams(params.toString());
  next.set("intent", intent);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function getIntentRecoveryOptions(
  currentIntent: ListingIntentFilter
): ListingIntentRecoveryOption[] {
  if (currentIntent === "all") return [];
  if (currentIntent === "rent") {
    return [
      { intent: "buy", label: "Switch to For sale" },
      { intent: "all", label: "Show all homes" },
    ];
  }
  return [
    { intent: "rent", label: "Switch to To rent" },
    { intent: "all", label: "Show all homes" },
  ];
}
