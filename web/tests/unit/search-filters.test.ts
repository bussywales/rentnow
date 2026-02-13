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
  assert.equal(params.get("rentalType"), "short_let");
  assert.equal(params.get("furnished"), "true");
  assert.equal(params.get("amenities"), "wifi,parking");
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
  assert.equal(hasActiveFilters({ ...emptyFilters, city: "Lagos" }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, minPrice: 50000 }), true);
  assert.equal(hasActiveFilters({ ...emptyFilters, bedrooms: 2 }), true);
});
