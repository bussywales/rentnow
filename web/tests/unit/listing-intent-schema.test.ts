import test from "node:test";
import assert from "node:assert/strict";
import { propertySchema } from "@/app/api/properties/route";
import { updateSchema } from "@/app/api/properties/[id]/route";

void test("property schema accepts listing_intent", () => {
  const payload = {
    title: "Test listing",
    city: "Lagos",
    rental_type: "long_term" as const,
    listing_intent: "buy" as const,
    price: 1000,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
  };
  const parsed = propertySchema.parse(payload);
  assert.equal(parsed.listing_intent, "buy");
});

void test("property update schema accepts listing_intent", () => {
  const parsed = updateSchema.parse({ listing_intent: "rent" });
  assert.equal(parsed.listing_intent, "rent");
});
