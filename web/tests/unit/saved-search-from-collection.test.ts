import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSavedSearchNameFromCollection,
  deriveSavedSearchFiltersFromCollectionListings,
} from "@/lib/saved-searches/from-collection";
import type { Property } from "@/lib/types";

function makeProperty(overrides: Partial<Property>): Property {
  return {
    id: overrides.id ?? "listing-default",
    owner_id: overrides.owner_id ?? "owner-1",
    title: overrides.title ?? "Listing",
    city: overrides.city ?? "Abuja",
    rental_type: overrides.rental_type ?? "long_term",
    price: overrides.price ?? 1000,
    currency: overrides.currency ?? "NGN",
    bedrooms: overrides.bedrooms ?? 2,
    bathrooms: overrides.bathrooms ?? 2,
    furnished: overrides.furnished ?? false,
    is_approved: overrides.is_approved ?? true,
    is_active: overrides.is_active ?? true,
    status: overrides.status ?? "live",
    ...overrides,
  };
}

void test("deriveSavedSearchFiltersFromCollectionListings prefers exact bedrooms and shared traits", () => {
  const filters = deriveSavedSearchFiltersFromCollectionListings([
    makeProperty({ city: "Abuja", bedrooms: 2, price: 1200, rental_type: "long_term", furnished: true }),
    makeProperty({ city: "Abuja", bedrooms: 2, price: 1800, rental_type: "long_term", furnished: true }),
  ]);

  assert.equal(filters.city, "Abuja");
  assert.equal(filters.minPrice, 1200);
  assert.equal(filters.maxPrice, 1800);
  assert.equal(filters.bedrooms, 2);
  assert.equal(filters.bedroomsMode, "exact");
  assert.equal(filters.rentalType, "long_term");
  assert.equal(filters.furnished, true);
});

void test("deriveSavedSearchFiltersFromCollectionListings falls back to minimum bedrooms when mixed", () => {
  const filters = deriveSavedSearchFiltersFromCollectionListings([
    makeProperty({ city: "Lagos", bedrooms: 2, price: 900 }),
    makeProperty({ city: "Lagos", bedrooms: 4, price: 2500 }),
    makeProperty({ city: "Abuja", bedrooms: 3, price: 1300 }),
  ]);

  assert.equal(filters.city, "Lagos");
  assert.equal(filters.bedrooms, 2);
  assert.equal(filters.bedroomsMode, "minimum");
  assert.equal(filters.minPrice, 900);
  assert.equal(filters.maxPrice, 2500);
});

void test("buildSavedSearchNameFromCollection trims and caps output", () => {
  const name = buildSavedSearchNameFromCollection("  Abuja Friday shortlist  ");
  assert.equal(name, "Shortlist: Abuja Friday shortlist");

  const longName = buildSavedSearchNameFromCollection("a".repeat(200));
  assert.equal(longName.endsWith("..."), true);
});
