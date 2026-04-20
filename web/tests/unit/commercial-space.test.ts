import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommercialSpaceFacts,
  formatCommercialLayoutType,
  getSpatialModelForListingType,
  normalizeSpatialFieldsForListingType,
} from "@/lib/properties/commercial-space";

void test("commercial space helper formats layout types and enclosed rooms", () => {
  assert.equal(formatCommercialLayoutType("open_plan"), "Open plan");

  const facts = buildCommercialSpaceFacts({
    commercial_layout_type: "suite",
    enclosed_rooms: 3,
    bathrooms: 1,
  });

  assert.deepEqual(
    facts.map((fact) => fact.value),
    ["Suite", "3 enclosed rooms", "1 bathroom"]
  );
});

void test("commercial space helper resolves listing type models", () => {
  assert.equal(getSpatialModelForListingType("apartment"), "residential");
  assert.equal(getSpatialModelForListingType("office"), "commercial");
  assert.equal(getSpatialModelForListingType("land"), "land");
});

void test("commercial space normalization clears conflicting field groups", () => {
  const commercial = normalizeSpatialFieldsForListingType({
    listing_type: "office" as const,
    bedrooms: 2,
    bathrooms: 1,
    commercial_layout_type: "suite",
    enclosed_rooms: 2,
  });
  assert.equal(commercial.bedrooms, 0);
  assert.equal(commercial.commercial_layout_type, "suite");

  const residential = normalizeSpatialFieldsForListingType({
    listing_type: "apartment" as const,
    bedrooms: 3,
    bathrooms: 2,
    commercial_layout_type: "suite",
    enclosed_rooms: 4,
  });
  assert.equal(residential.commercial_layout_type, null);
  assert.equal(residential.enclosed_rooms, null);

  const land = normalizeSpatialFieldsForListingType({
    listing_type: "land" as const,
    bedrooms: 1,
    bathrooms: 1,
    commercial_layout_type: "open_plan",
    enclosed_rooms: 2,
  });
  assert.equal(land.bedrooms, 0);
  assert.equal(land.bathrooms, 0);
  assert.equal(land.commercial_layout_type, null);
});
