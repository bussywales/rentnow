import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filtersToChips,
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
    commercialLayoutType: null,
    enclosedRoomsMin: null,
    listingIntent: "buy",
    stay: "shortlet",
    rentalType: "short_let",
    furnished: true,
    powerBackup: true,
    waterBorehole: true,
    broadbandReady: true,
    securityFeature: true,
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
  assert.equal(params.get("powerBackup"), "true");
  assert.equal(params.get("waterBorehole"), "true");
  assert.equal(params.get("broadbandReady"), "true");
  assert.equal(params.get("securityFeature"), "true");
  assert.equal(params.get("amenities"), "wifi,parking");
});

test("filtersToSearchParams serializes commercial filters and suppresses stale bedroom params for commercial types", () => {
  const filters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: 3,
    bedroomsMode: "minimum",
    includeSimilarOptions: true,
    propertyType: "office",
    commercialLayoutType: "suite",
    enclosedRoomsMin: 2,
    listingIntent: undefined,
    stay: null,
    rentalType: null,
    furnished: null,
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  };

  const params = filtersToSearchParams(filters);
  assert.equal(params.get("propertyType"), "office");
  assert.equal(params.get("commercialLayoutType"), "suite");
  assert.equal(params.get("enclosedRoomsMin"), "2");
  assert.equal(params.get("bedrooms"), null);
  assert.equal(params.get("bedroomsMode"), null);
  assert.equal(params.get("includeSimilarOptions"), null);
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
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
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
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
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

test("parseFilters reads compact local living filters", () => {
  const parsed = parseFiltersFromParams({
    powerBackup: "true",
    waterBorehole: "true",
    broadbandReady: "true",
    securityFeature: "true",
  });

  assert.equal(parsed.powerBackup, true);
  assert.equal(parsed.waterBorehole, true);
  assert.equal(parsed.broadbandReady, true);
  assert.equal(parsed.securityFeature, true);

  const savedParsed = parseFiltersFromSavedSearch({
    powerBackup: true,
    waterBorehole: "true",
    broadbandReady: true,
    securityFeature: "true",
  });

  assert.equal(savedParsed.powerBackup, true);
  assert.equal(savedParsed.waterBorehole, true);
  assert.equal(savedParsed.broadbandReady, true);
  assert.equal(savedParsed.securityFeature, true);
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

  const parsedFromIntent = parseFiltersFromParams({ intent: "shortlet" });
  assert.equal(parsedFromIntent.stay, "shortlet");
  assert.equal(parsedFromIntent.listingIntent, "rent");

  const savedParsedFromIntent = parseFiltersFromSavedSearch({ intent: "shortlet" });
  assert.equal(savedParsedFromIntent.stay, "shortlet");
  assert.equal(savedParsedFromIntent.listingIntent, "rent");
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

test("parseFilters reads commercial discovery filters", () => {
  const parsed = parseFiltersFromParams({
    propertyType: "office",
    commercialLayoutType: "suite",
    enclosedRoomsMin: "3",
  });
  assert.equal(parsed.propertyType, "office");
  assert.equal(parsed.commercialLayoutType, "suite");
  assert.equal(parsed.enclosedRoomsMin, 3);

  const savedParsed = parseFiltersFromSavedSearch({
    propertyType: "shop",
    commercialLayoutType: "shop_floor",
    enclosedRoomsMin: 0,
  });
  assert.equal(savedParsed.propertyType, "shop");
  assert.equal(savedParsed.commercialLayoutType, "shop_floor");
  assert.equal(savedParsed.enclosedRoomsMin, 0);
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
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
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
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  };

  assert.equal(propertyMatchesFilters(shortletProperty, filters), true);
  assert.equal(propertyMatchesFilters(nonShortletProperty, filters), false);
});

test("propertyMatchesFilters treats shortlet as rent intent and off-plan as buy intent", () => {
  const shortletListing = {
    city: "Lagos",
    price: 300,
    currency: "USD",
    bedrooms: 1,
    rental_type: "short_let" as const,
    furnished: true,
    amenities: [],
    listing_type: "studio" as const,
    listing_intent: "shortlet" as const,
    shortlet_settings: [{ booking_mode: "request", nightly_price_minor: 45000 }],
  };
  const offPlanListing = {
    ...shortletListing,
    rental_type: "long_term" as const,
    listing_intent: "off_plan" as const,
    shortlet_settings: [],
  };
  const rentFilters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: "rent",
    stay: null,
    rentalType: null,
    furnished: null,
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  };
  const buyFilters: ParsedSearchFilters = {
    ...rentFilters,
    listingIntent: "buy",
  };

  assert.equal(propertyMatchesFilters(shortletListing, rentFilters), true);
  assert.equal(propertyMatchesFilters(offPlanListing, buyFilters), true);
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
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
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

test("filtersToChips renders shortlet as a single intent chip", () => {
  const chips = filtersToChips({
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: null,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: null,
    listingIntent: "rent",
    stay: "shortlet",
    rentalType: null,
    furnished: null,
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  });

  assert.deepEqual(chips, [{ label: "Intent", value: "Shortlet" }]);
});

test("propertyMatchesFilters respects structured local living filters", () => {
  const property = {
    city: "Abuja",
    price: 1200,
    currency: "USD",
    bedrooms: 2,
    rental_type: "long_term" as const,
    furnished: true,
    listing_type: "apartment" as const,
    backup_power_type: "inverter",
    water_supply_type: "mixed",
    internet_availability: "fibre",
    security_type: "gated_estate",
    amenities: [],
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
    listingIntent: undefined,
    stay: null,
    rentalType: null,
    furnished: null,
    powerBackup: true,
    waterBorehole: true,
    broadbandReady: true,
    securityFeature: true,
    amenities: [],
  };

  assert.equal(propertyMatchesFilters(property, filters), true);
  assert.equal(
    propertyMatchesFilters({ ...property, backup_power_type: "none" }, filters),
    false
  );
});

test("propertyMatchesFilters applies commercial filters and ignores bedroom semantics for commercial type searches", () => {
  const office = {
    city: "Lagos",
    price: 500000,
    currency: "NGN",
    bedrooms: 0,
    bathrooms: 2,
    rental_type: "long_term" as const,
    furnished: false,
    listing_type: "office" as const,
    commercial_layout_type: "suite" as const,
    enclosed_rooms: 3,
    amenities: [],
  };

  const filters: ParsedSearchFilters = {
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: 4,
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    propertyType: "office",
    commercialLayoutType: "suite",
    enclosedRoomsMin: 2,
    listingIntent: undefined,
    stay: null,
    rentalType: null,
    furnished: null,
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  };

  assert.equal(propertyMatchesFilters(office, filters), true);
  assert.equal(
    propertyMatchesFilters({ ...office, commercial_layout_type: "partitioned" }, filters),
    false
  );
  assert.equal(
    propertyMatchesFilters({ ...office, enclosed_rooms: 1 }, filters),
    false
  );
});

test("filtersToChips renders commercial discovery filters without stale bedroom chips", () => {
  const chips = filtersToChips({
    city: null,
    minPrice: null,
    maxPrice: null,
    currency: null,
    bedrooms: 4,
    bedroomsMode: "minimum",
    includeSimilarOptions: true,
    propertyType: "office",
    commercialLayoutType: "suite",
    enclosedRoomsMin: 2,
    listingIntent: undefined,
    stay: null,
    rentalType: null,
    furnished: null,
    powerBackup: null,
    waterBorehole: null,
    broadbandReady: null,
    securityFeature: null,
    amenities: [],
  });

  assert.deepEqual(chips, [
    { label: "Property type", value: "office" },
    { label: "Layout", value: "Suite" },
    { label: "Enclosed rooms", value: "2+ minimum" },
  ]);
});
