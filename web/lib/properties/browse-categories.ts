import { parseIntent } from "@/lib/search-intent";
import type { ListingIntent, ListingIntentFilter } from "@/lib/types";
import { normalizeListingIntent } from "@/lib/listing-intents";

export type PropertiesBrowseCategory =
  | "rent"
  | "buy"
  | "shortlet"
  | "off_plan"
  | "all";

export type PropertiesBrowseCategoryOption = {
  value: PropertiesBrowseCategory;
  label: string;
};

export type PropertiesCategoryContext = {
  listingIntent: ListingIntentFilter;
  stay: "shortlet" | null;
  exactListingIntent: ListingIntent | null;
};

const CATEGORY_VALUES: PropertiesBrowseCategory[] = [
  "rent",
  "buy",
  "shortlet",
  "off_plan",
  "all",
];

export const PROPERTIES_BROWSE_CATEGORY_OPTIONS: PropertiesBrowseCategoryOption[] = [
  { value: "rent", label: "To rent" },
  { value: "buy", label: "For sale" },
  { value: "shortlet", label: "Short-lets" },
  { value: "off_plan", label: "Off-plan" },
  { value: "all", label: "All homes" },
];

export function isPropertiesBrowseCategory(
  value: string | null | undefined
): value is PropertiesBrowseCategory {
  if (!value) return false;
  return CATEGORY_VALUES.includes(value as PropertiesBrowseCategory);
}

export function getPropertiesCategoryContext(
  category: PropertiesBrowseCategory
): PropertiesCategoryContext {
  if (category === "shortlet") {
    return {
      listingIntent: "rent",
      stay: "shortlet",
      exactListingIntent: "shortlet",
    };
  }
  if (category === "off_plan") {
    return {
      listingIntent: "buy",
      stay: null,
      exactListingIntent: "off_plan",
    };
  }
  if (category === "buy") {
    return {
      listingIntent: "buy",
      stay: null,
      exactListingIntent: null,
    };
  }
  if (category === "all") {
    return {
      listingIntent: "all",
      stay: null,
      exactListingIntent: null,
    };
  }
  return {
    listingIntent: "rent",
    stay: null,
    exactListingIntent: null,
  };
}

export function resolvePropertiesBrowseCategory(input: {
  categoryParam?: string | null;
  intentParam?: string | null;
  stayParam?: string | null;
  listingIntentParam?: string | null;
  fallbackIntent?: ListingIntentFilter;
}): PropertiesBrowseCategory {
  if (isPropertiesBrowseCategory(input.categoryParam)) return input.categoryParam;
  const normalizedListingIntent = normalizeListingIntent(input.listingIntentParam);
  if (normalizedListingIntent === "off_plan") return "off_plan";
  if (normalizedListingIntent === "shortlet") return "shortlet";
  if (input.stayParam === "shortlet") return "shortlet";

  const parsedIntent = parseIntent(input.intentParam) ?? input.fallbackIntent;
  if (parsedIntent === "buy") return "buy";
  if (parsedIntent === "all") return "all";
  return "rent";
}

export function buildPropertiesCategoryParams(
  baseParams: URLSearchParams,
  category: PropertiesBrowseCategory
): URLSearchParams {
  const next = new URLSearchParams(baseParams.toString());
  const context = getPropertiesCategoryContext(category);

  next.set("category", category);
  next.set("intent", context.listingIntent);
  if (context.stay === "shortlet") {
    next.set("stay", "shortlet");
  } else {
    next.delete("stay");
  }

  if (context.exactListingIntent === "off_plan") {
    next.set("listingIntent", "off_plan");
  } else if (context.exactListingIntent === "shortlet") {
    next.set("listingIntent", "shortlet");
  } else {
    next.delete("listingIntent");
  }

  if (category !== "rent") {
    next.delete("rentalType");
  }

  next.set("page", "1");
  next.delete("savedSearchId");
  next.delete("source");

  return next;
}
