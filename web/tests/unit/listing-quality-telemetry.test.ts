import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeListingQualityFixClickTelemetry,
  normalizeListingQualityGuidanceTelemetry,
  normalizeListingQualitySubmitTelemetry,
} from "@/lib/properties/listing-quality-telemetry";

void test("normalize guidance telemetry accepts stable submit-step payload", () => {
  assert.deepEqual(
    normalizeListingQualityGuidanceTelemetry({
      source: "submit_step",
      bestNextFixKey: "missing_images",
      scoreBefore: 57,
      missingCountBefore: 4,
    }),
    {
      source: "submit_step",
      bestNextFixKey: "missing_images",
      scoreBefore: 57,
      missingCountBefore: 4,
    }
  );
});

void test("normalize fix click telemetry requires valid fix key and target step", () => {
  assert.equal(
    normalizeListingQualityFixClickTelemetry({
      source: "submit_step",
      bestNextFixKey: "missing_images",
      clickedFixKey: "nope",
      targetStep: "details",
      scoreBefore: 57,
      missingCountBefore: 4,
    }),
    null
  );

  assert.deepEqual(
    normalizeListingQualityFixClickTelemetry({
      source: "submit_step",
      bestNextFixKey: "missing_images",
      clickedFixKey: "missing_description",
      targetStep: "details",
      scoreBefore: 57,
      missingCountBefore: 4,
    }),
    {
      source: "submit_step",
      bestNextFixKey: "missing_images",
      clickedFixKey: "missing_description",
      targetStep: "details",
      scoreBefore: 57,
      missingCountBefore: 4,
    }
  );
});

void test("normalize submit telemetry clamps scores and counts while preserving improvement state", () => {
  assert.deepEqual(
    normalizeListingQualitySubmitTelemetry({
      source: "submit_step",
      bestNextFixKey: null,
      scoreBefore: 12.6,
      scoreAtSubmit: 104,
      scoreImproved: true,
      missingCountBefore: 8,
      missingCountAtSubmit: -3,
    }),
    {
      source: "submit_step",
      bestNextFixKey: null,
      scoreBefore: 13,
      scoreAtSubmit: 100,
      scoreImproved: true,
      missingCountBefore: 8,
      missingCountAtSubmit: 0,
    }
  );
});
