import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAdminListingQuality,
  resolveAdminListingQualityStatus,
} from "@/lib/admin/listing-quality";

void test("admin listing quality status thresholds map score bands", () => {
  assert.equal(resolveAdminListingQualityStatus(95), "Strong");
  assert.equal(resolveAdminListingQualityStatus(85), "Strong");
  assert.equal(resolveAdminListingQualityStatus(84), "Fair");
  assert.equal(resolveAdminListingQualityStatus(60), "Fair");
  assert.equal(resolveAdminListingQualityStatus(59), "Needs work");
});

void test("admin listing quality summary reuses shared completeness scoring", () => {
  const summary = computeAdminListingQuality({
    title: "Modern 2 Bed Apartment in Victoria Island",
    description: "Bright apartment with parking and balcony.",
    has_cover: true,
    photo_count: 5,
    price: 2400,
    currency: "USD",
    city: "Lagos",
  });

  assert.equal(summary.completeness.score, 100);
  assert.equal(summary.status, "Strong");
  assert.deepEqual(summary.completeness.missingItems, []);
});

