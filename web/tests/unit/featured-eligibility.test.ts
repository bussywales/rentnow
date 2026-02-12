import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FEATURED_ELIGIBILITY_SETTINGS,
  formatFeaturedMinorAmount,
  getFeaturedEligibility,
} from "@/lib/featured/eligibility";

void test("featured eligibility enforces approval, active, photos, and description by default", () => {
  const result = getFeaturedEligibility(
    {
      status: "live",
      is_active: true,
      is_approved: false,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Short",
      images: [{}, {}],
    },
    DEFAULT_FEATURED_ELIGIBILITY_SETTINGS
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("Listing must be approved before requesting Featured."));
  assert.ok(result.reasons.includes("Add at least 3 photos."));
  assert.ok(result.reasons.includes("Add at least 80 description characters."));
});

void test("featured eligibility ignores disabled requirement toggles", () => {
  const result = getFeaturedEligibility(
    {
      status: "draft",
      is_active: false,
      is_approved: false,
      expires_at: null,
      is_demo: true,
      is_featured: false,
      featured_until: null,
      description: "",
      images: [],
    },
    {
      ...DEFAULT_FEATURED_ELIGIBILITY_SETTINGS,
      requiresApprovedListing: false,
      requiresActiveListing: false,
      requiresNotDemo: false,
      minPhotos: 0,
      minDescriptionChars: 0,
    }
  );

  assert.equal(result.eligible, true);
});

void test("featured pricing formatter renders pounds from minor units", () => {
  assert.equal(formatFeaturedMinorAmount(1999, "GBP", "en-GB"), "£19.99");
});
