import test from "node:test";
import assert from "node:assert/strict";
import { propertySchema } from "@/app/api/properties/route";
import { updateSchema } from "@/app/api/properties/[id]/route";

void test("property create accepts null imageMeta", () => {
  const payload = {
    title: "Test listing",
    city: "Lagos",
    rental_type: "long_term",
    price: 1200,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    imageMeta: null,
    imageUrls: ["https://example.com/photo.jpg"],
  };
  const parsed = propertySchema.parse(payload);
  assert.equal(parsed.imageMeta, undefined);
});

void test("property update accepts null imageMeta", () => {
  const parsed = updateSchema.parse({ imageMeta: null });
  assert.equal(parsed.imageMeta, undefined);
});
