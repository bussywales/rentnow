import test from "node:test";
import assert from "node:assert/strict";

import { propertySchema } from "@/app/api/properties/route";
import { isRentIntent, isSaleIntent } from "@/lib/listing-intents";
import {
  isCommercialListingType,
  isResidentialListingType,
} from "@/lib/properties/listing-types";

void test("isResidentialListingType covers residential and non-residential types", () => {
  assert.equal(isResidentialListingType("apartment"), true);
  assert.equal(isResidentialListingType("condo"), true);
  assert.equal(isResidentialListingType("land"), false);
  assert.equal(isResidentialListingType(null), false);
});

void test("isCommercialListingType covers office and shop only", () => {
  assert.equal(isCommercialListingType("office"), true);
  assert.equal(isCommercialListingType("shop"), true);
  assert.equal(isCommercialListingType("apartment"), false);
  assert.equal(isCommercialListingType("land"), false);
});

void test("property schema allows 0 rooms for any listing type", () => {
  const base = {
    title: "Test listing",
    city: "Lagos",
    rental_type: "long_term" as const,
    price: 1000,
    currency: "USD",
    furnished: false,
  };

  const landResult = propertySchema.safeParse({
    ...base,
    listing_type: "land" as const,
    bedrooms: 0,
    bathrooms: 0,
  });
  assert.equal(landResult.success, true, "expected land listings to allow 0 rooms");

  const apartmentResult = propertySchema.safeParse({
    ...base,
    listing_type: "apartment" as const,
    bedrooms: 0,
    bathrooms: 0,
  });
  assert.equal(apartmentResult.success, true, "expected residential listings to allow 0 rooms");
});

void test("property schema allows commercial listings without an explicit bedroom count", () => {
  const result = propertySchema.safeParse({
    title: "Commercial suite",
    city: "Lagos",
    rental_type: "long_term" as const,
    listing_type: "office" as const,
    commercial_layout_type: "suite" as const,
    enclosed_rooms: 0,
    price: 250000,
    currency: "NGN",
    bathrooms: 1,
    furnished: false,
  });

  assert.equal(result.success, true, "expected commercial listings to omit bedrooms safely");
});

void test("property schema requires layout type for commercial listing types", () => {
  const result = propertySchema.safeParse({
    title: "Shop unit",
    city: "Lagos",
    rental_type: "long_term" as const,
    listing_type: "shop" as const,
    price: 250000,
    currency: "NGN",
    bathrooms: 1,
    furnished: false,
  });

  assert.equal(result.success, false, "expected commercial listings to require layout type");
  assert.match(JSON.stringify(result.error.flatten().fieldErrors), /Layout type is required/);
});

void test("property schema still requires bedrooms for residential listing types", () => {
  const result = propertySchema.safeParse({
    title: "Apartment listing",
    city: "Lagos",
    rental_type: "long_term" as const,
    listing_type: "apartment" as const,
    price: 250000,
    currency: "NGN",
    bathrooms: 1,
    furnished: false,
  });

  assert.equal(result.success, false, "expected residential listings to keep bedroom validation");
  assert.match(JSON.stringify(result.error.flatten().fieldErrors), /Bedrooms is required/);
});

void test("rent intent helpers reflect sale vs rent logic", () => {
  assert.equal(isSaleIntent("buy"), true);
  assert.equal(isRentIntent("buy"), false);
  assert.equal(isRentIntent("rent"), true);
});
