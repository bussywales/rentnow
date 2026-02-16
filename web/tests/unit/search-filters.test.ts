import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseFiltersFromParams,
  parseFiltersFromSavedSearch,
  propertyMatchesFilters,
} from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

test("filtersToSearchParams serializes parsed filters", () => {
  const filters: ParsedSearchFilters = {
    city: "Lagos",
    minPrice: 500,
    maxPrice: 1500,
    currency: "USD",
    bedrooms: 2,
    bedroomsMode: "minimum",
    includeSimilarOptions: true,
    propertyType: "apartment",
    listingIntent: "buy",
    stay: "shortlet",
    rentalType: "short_let",
    furnished: true,
    amenities: ["wifi", "parking"],
  };

  const params = filtersToSearchParams(filters);

  assert.equal(params.get("city"), "Lagos");
  assert.equal(params.get("minPrice"), "500");
  assert.equal(params.get("maxPrice"), "1500");
  assert.equal(params.get("currency"), "USD");
  assert.equal(params.get("bedrooms"), "2");
  assert.equal(params.get("bedroomsMode"), "minimum");
  assert.equal(params.get("includeSimilarOptions"), "true");
  assert.equal(params.get("propertyType"), "apartment");
  assert.equal(params.get("intent"), "buy");
  assert.equal(params.get("stay"), null);
  assert.equal(params.get("rentalType"), "short_let");
  assert.equal(params.get("furnished"), "true");
  assert.equal(params.get("amenities"), "wifi,parking");
});

test("filtersToSearchParams forces rent intent when stay=shortlet", () => {
  const filters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: "all",
    stay: "shortlet",
    rentalType: null,
    furnished: null,
    amenities: [],
  };

  const params = filtersToSearchParams(filters);
  assert.equal(params.get("intent"), "rent");
  assert.equal(params.get("stay"), "shortlet");
});

test("filtersToSearchParams omits intent when set to all", () => {
  const filters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: "all",
    rentalType: null,
    furnished: null,
    amenities: [],
  };

  const params = filtersToSearchParams(filters);
  assert.equal(params.get("intent"), null);
});

test("parseFilters clamps negative numeric values to zero", () => {
  const parsed = parseFiltersFromParams({
    minPrice: "-50",
    maxPrice: "-1",
    bedrooms: "-3",
  });

  assert.equal(parsed.minPrice, 0);
  assert.equal(parsed.maxPrice, 0);
  assert.equal(parsed.bedrooms, 0);

  const savedParsed = parseFiltersFromSavedSearch({
    minPrice: -25,
    maxPrice: "-12",
    bedrooms: -2,
  });

  assert.equal(savedParsed.minPrice, 0);
  assert.equal(savedParsed.maxPrice, 0);
  assert.equal(savedParsed.bedrooms, 0);
});

test("stay shortlet parses from query and saved search", () => {
  const parsed = parseFiltersFromParams({ stay: "shortlet" });
  assert.equal(parsed.stay, "shortlet");
  assert.equal(parsed.listingIntent, "rent");

  const parsedFromCategory = parseFiltersFromParams({ category: "shortlet" });
  assert.equal(parsedFromCategory.stay, "shortlet");
  assert.equal(parsedFromCategory.listingIntent, "rent");

  const savedParsed = parseFiltersFromSavedSearch({ stay: "shortlet" });
  assert.equal(savedParsed.stay, "shortlet");
  assert.equal(savedParsed.listingIntent, "rent");
});

test("stay shortlet is cleared for sale intent", () => {
  const parsed = parseFiltersFromParams({ intent: "buy", stay: "shortlet" });
  assert.equal(parsed.listingIntent, "buy");
  assert.equal(parsed.stay, null);

  const savedParsed = parseFiltersFromSavedSearch({ intent: "buy", stay: "shortlet" });
  assert.equal(savedParsed.listingIntent, "buy");
  assert.equal(savedParsed.stay, null);
});

test("parseFilters defaults bedroom mode to exact", () => {
  const parsed = parseFiltersFromParams({ bedrooms: "2" });
  assert.equal(parsed.bedrooms, 2);
  assert.equal(parsed.bedroomsMode, "exact");
  assert.equal(parsed.includeSimilarOptions, false);
});

test("propertyMatchesFilters enforces exact bedrooms unless minimum is selected", () => {
  const baseProperty = {
    city: "Abuja",
    price: 1000,
    currency: "NGN",
    bedrooms: 4,
    rental_type: "long_term" as const,
    furnished: false,
    amenities: ["parking"],
    listing_type: "apartment" as const,
  };

  const exactFilters: ParsedSearchFilters = {
    city: "Abuja",
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: 2,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: undefined,
    rentalType: null,
    furnished: null,
    amenities: [],
  };

  const minimumFilters: ParsedSearchFilters = {
    ...exactFilters,
    bedroomsMode: "minimum",
  };

  assert.equal(propertyMatchesFilters(baseProperty, exactFilters), false);
  assert.equal(propertyMatchesFilters(baseProperty, minimumFilters), true);
});

test("propertyMatchesFilters enforces stay=shortlet", () => {
  const shortletProperty = {
    city: "Lagos",
    price: 300,
    currency: "USD",
    bedrooms: 1,
    rental_type: "short_let" as const,
    furnished: true,
    amenities: [],
    listing_type: "studio" as const,
    listing_intent: "shortlet" as const,
    shortlet_settings: [{ booking_mode: "instant", nightly_price_minor: 50000 }],
  };

  const nonShortletProperty = {
    ...shortletProperty,
    rental_type: "long_term" as const,
    listing_intent: "rent_lease" as const,
    shortlet_settings: [],
  };

  const filters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: "all",
    stay: "shortlet",
    rentalType: null,
    furnished: null,
    amenities: [],
  };

  assert.equal(propertyMatchesFilters(shortletProperty, filters), true);
  assert.equal(propertyMatchesFilters(nonShortletProperty, filters), false);
});

test("hasActiveFilters only returns true for real search filters", () => {
  const emptyFilters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    rentalType: null,
    furnished: null,
    amenities: [],
  };

  assert.equal(hasActiveFilters(emptyFilters), false);
  assert.equal(hasActiveFilters({ ...emptyFilters, listingIntent: "all" }), false);
  assert.equal(hasActiveFilters({ ...emptyFilters, listingIntent: "buy" }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, stay: "shortlet" }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, city: "Lagos" }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, minPrice: 50000 }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, bedrooms: 2 }), true);
});
