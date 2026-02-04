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

void test("property schemas allow null rent_period for sale intent", () => {
  const base = {
    title: "Test listing",
    city: "Lagos",
    rental_type: "long_term" as const,
    listing_intent: "buy" as const,
    price: 1000,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    rent_period: null,
  };
  const created = propertySchema.parse(base);
  assert.equal(created.rent_period, null);

  const updated = updateSchema.parse({ listing_intent: "buy", rent_period: null });
  assert.equal(updated.rent_period, null);
});

void test("property schema accepts student and hostel listing types", () => {
  const base = {
    title: "Test listing",
    city: "Lagos",
    rental_type: "long_term" as const,
    price: 1000,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
  };

  const student = propertySchema.parse({ ...base, listing_type: "student" as const });
  assert.equal(student.listing_type, "student");

  const hostel = updateSchema.parse({ listing_type: "hostel" as const });
  assert.equal(hostel.listing_type, "hostel");
});
