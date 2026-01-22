import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewAndPublishChecklist } from "@/lib/properties/review-publish";
import { REVIEW_PUBLISH_COPY } from "@/lib/review-publish-microcopy";

const baseListing = {
  id: "test",
  title: "Test listing",
  country_code: "GB",
  state_region: null,
  admin_area_2: null,
  postal_code: null,
  city: null,
  latitude: null,
  longitude: null,
  location_label: null,
  location_place_id: null,
  images: [] as { image_url: string }[],
  cover_image_url: null as string | null,
};

void test("does not add blocker when require_location_pin_for_publish is off", () => {
  const checklist = buildReviewAndPublishChecklist(baseListing, {
    requireLocationPinForPublish: false,
  });
  assert.equal(checklist.blocking.length, 0);
});

void test("adds blocker when pin required and missing", () => {
  const checklist = buildReviewAndPublishChecklist(baseListing, {
    requireLocationPinForPublish: true,
  });
  assert.equal(checklist.blocking.length, 1);
  assert.equal(checklist.blocking[0]?.code, "LOCATION_PIN_REQUIRED");
});

void test("recommended ordering is stable and actions map to deep links", () => {
  const checklist = buildReviewAndPublishChecklist(baseListing, {
    requireLocationPinForPublish: false,
  });
  const codes = checklist.recommended.map((item) => item.code);
  assert.deepEqual(codes, [
    "PHOTOS_TOO_FEW",
    "COVER_WEAK_OR_MISSING",
    "LOCATION_QUALITY_MEDIUM_OR_WEAK",
    "MISSING_POSTAL",
  ]);
  assert.equal(checklist.recommended[0]?.actionTarget.step, "photos");
  assert.equal(checklist.recommended[2]?.actionTarget.focus, "location");
});

void test("microcopy keys are present", () => {
  assert.equal(REVIEW_PUBLISH_COPY.title, "Review & publish");
  assert.equal(REVIEW_PUBLISH_COPY.requiredTitle, "Required to publish");
  assert.ok(REVIEW_PUBLISH_COPY.recommended.PHOTOS_TOO_FEW.title.length > 0);
});
