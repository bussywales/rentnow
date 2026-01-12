import { test } from "node:test";
import assert from "node:assert/strict";
import { filtersToSearchParams, parseFiltersFromParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

test("filtersToSearchParams serializes parsed filters", () => {
  const filters: ParsedSearchFilters = {
    city: "Lagos",
    minPrice: 500,
    maxPrice: 1500,
    currency: "USD",
    bedrooms: 2,
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
