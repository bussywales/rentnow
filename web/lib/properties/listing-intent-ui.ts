import type { ListingIntentFilter } from "@/lib/types";

export type ListingIntentToggleOption = {
  value: ListingIntentFilter;
  label: string;
};

export const LISTING_INTENT_TOGGLE_OPTIONS: ListingIntentToggleOption[] = [
  { value: "rent", label: "To rent" },
  { value: "buy", label: "For sale" },
  { value: "all", label: "All" },
];

export function getIntentModeHint(intent: ListingIntentFilter): string | null {
  if (intent === "rent") {
    return "Showing rentals - switch to All to include for-sale homes.";
  }
  if (intent === "buy") {
    return "Showing for-sale homes - switch to All to include rentals.";
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
      { intent: "all", label: "Try All" },
      { intent: "buy", label: "Try For sale" },
    ];
  }
  return [
    { intent: "all", label: "Try All" },
    { intent: "rent", label: "Try To rent" },
  ];
}
