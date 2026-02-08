import test from "node:test";
import assert from "node:assert/strict";

import { propertySchema } from "@/app/api/properties/route";
import { isRentIntent, isSaleIntent } from "@/lib/listing-intents";
import { isResidentialListingType } from "@/lib/properties/listing-types";

void test("isResidentialListingType covers residential and non-residential types", () => {
  assert.equal(isResidentialListingType("apartment"), true);
  assert.equal(isResidentialListingType("condo"), true);
  assert.equal(isResidentialListingType("land"), false);
  assert.equal(isResidentialListingType(null), false);
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

void test("rent intent helpers reflect sale vs rent logic", () => {
  assert.equal(isSaleIntent("buy"), true);
  assert.equal(isRentIntent("buy"), false);
  assert.equal(isRentIntent("rent"), true);
});
