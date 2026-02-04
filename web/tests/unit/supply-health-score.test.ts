import test from "node:test";
import assert from "node:assert/strict";
import { computeQualityScore } from "@/lib/admin/supply-health.server";

void test("quality score rewards core listing fields", () => {
  const listing = {
    title: "Spacious two bedroom in Ikeja with balcony",
    description: "A bright, well-maintained apartment with reliable water, power, and secure parking.".repeat(2),
    price: 250000,
    currency: "NGN",
    city: "Lagos",
    location_label: "Ikeja",
    latitude: 6.5,
    longitude: 3.4,
    listing_intent: "rent",
    status: "live",
    profiles: { email_verified: true, phone_verified: true },
  };

  const result = computeQualityScore({ listing, photoCount: 8 });
  assert.ok(result.score >= 85);
  assert.equal(result.missing.length, 0);
});

void test("quality score flags missing fields", () => {
  const listing = {
    title: "Short",
    description: "",
    price: null,
    currency: null,
    city: null,
    location_label: null,
    latitude: null,
    longitude: null,
    listing_intent: null,
    status: "draft",
    profiles: { email_verified: false, phone_verified: false },
  };

  const result = computeQualityScore({ listing, photoCount: 0 });
  assert.ok(result.score < 40);
  assert.ok(result.missing.includes("no_photos"));
  assert.ok(result.missing.includes("short_title"));
  assert.ok(result.missing.includes("no_description"));
  assert.ok(result.missing.includes("no_price"));
  assert.ok(result.missing.includes("no_location"));
  assert.ok(result.missing.includes("no_intent"));
  assert.ok(result.missing.includes("not_live"));
});
