import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveMissingReasons,
  formatMissingLabels,
  formatOwnerLabel,
} from "../../lib/admin/affected-listings";

void test("formatOwnerLabel prefers full name then business name", () => {
  assert.equal(
    formatOwnerLabel("1234567890abcdef", {
      id: "1234567890abcdef",
      full_name: "Ada Lovelace",
      business_name: "Ada Rentals",
    }),
    "Ada Lovelace"
  );
  assert.equal(
    formatOwnerLabel("1234567890abcdef", {
      id: "1234567890abcdef",
      full_name: null,
      business_name: "Ada Rentals",
    }),
    "Ada Rentals"
  );
  assert.equal(formatOwnerLabel("1234567890abcdef", null), "12345678...");
});

void test("deriveMissingReasons flags mismatches and missing photos", () => {
  const reasons = deriveMissingReasons(
    {
      id: "prop-1",
      title: "Test",
      owner_id: "owner-1",
      status: null,
      is_approved: true,
      is_active: true,
      city: "",
      country: "Nigeria",
      country_code: null,
      listing_type: null,
      size_value: 55,
      size_unit: null,
      deposit_amount: 2000,
      deposit_currency: null,
      created_at: null,
      updated_at: null,
      property_images: [],
    },
    true
  );

  assert.ok(reasons.includes("country_code"));
  assert.ok(reasons.includes("listing_type"));
  assert.ok(reasons.includes("city"));
  assert.ok(reasons.includes("size_unit"));
  assert.ok(reasons.includes("deposit_currency"));
  assert.ok(reasons.includes("photos"));
});

void test("deriveMissingReasons skips photos when unavailable", () => {
  const reasons = deriveMissingReasons(
    {
      id: "prop-2",
      title: "Test 2",
      owner_id: "owner-2",
      status: null,
      is_approved: true,
      is_active: true,
      city: "Lagos",
      country: "Nigeria",
      country_code: "NG",
      listing_type: "apartment",
      size_value: null,
      size_unit: "sqm",
      deposit_amount: null,
      deposit_currency: "NGN",
      created_at: null,
      updated_at: null,
      property_images: [],
    },
    false
  );

  assert.ok(!reasons.includes("photos"));
  assert.ok(reasons.includes("size_value"));
  assert.ok(reasons.includes("deposit_amount"));
});

void test("formatMissingLabels maps reasons to readable labels", () => {
  const labels = formatMissingLabels(["country_code", "listing_type", "photos"]);
  assert.deepEqual(labels, ["country code", "listing type", "photos"]);
});
