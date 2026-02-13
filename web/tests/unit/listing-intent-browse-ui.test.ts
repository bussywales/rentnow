import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClearFiltersHref,
  buildIntentHref,
  getIntentModeHint,
  getIntentRecoveryOptions,
  getIntentSummaryCopy,
  LISTING_INTENT_TOGGLE_OPTIONS,
} from "@/lib/properties/listing-intent-ui";

test("listing intent toggle options use browse copy", () => {
  assert.deepEqual(
    LISTING_INTENT_TOGGLE_OPTIONS.map((option) => option.label),
    ["To rent", "For sale", "All homes"]
  );
});

test("intent mode hint copy appears only for filtered modes", () => {
  assert.equal(
    getIntentModeHint("rent"),
    "Showing rentals. Switch to All homes to include for-sale homes."
  );
  assert.equal(
    getIntentModeHint("buy"),
    "Showing for-sale homes. Switch to All homes to include rentals."
  );
  assert.equal(
    getIntentModeHint("all"),
    "Showing all homes across rent and sale listings."
  );
});

test("intent recovery options and links preserve existing filters", () => {
  assert.deepEqual(getIntentRecoveryOptions("rent"), [
    { intent: "buy", label: "Switch to For sale" },
    { intent: "all", label: "Show all homes" },
  ]);
  assert.deepEqual(getIntentRecoveryOptions("buy"), [
    { intent: "rent", label: "Switch to To rent" },
    { intent: "all", label: "Show all homes" },
  ]);
  assert.deepEqual(getIntentRecoveryOptions("all"), []);

  const params = new URLSearchParams("city=Lagos&bedrooms=4&intent=buy&source=saved-search");
  const href = buildIntentHref("/properties", params, "all");
  assert.equal(href, "/properties?city=Lagos&bedrooms=4&intent=all&source=saved-search");
});

test("clear filters href keeps intent and preserves non-filter params", () => {
  const params = new URLSearchParams(
    "city=Lagos&bedrooms=4&intent=buy&source=saved-search&utm_source=whatsapp&page=3"
  );
  const href = buildClearFiltersHref("/properties", params, "buy");
  assert.equal(href, "/properties?intent=buy&utm_source=whatsapp");
});

test("intent summary copy matches current mode", () => {
  assert.equal(getIntentSummaryCopy("rent"), "Mode: To rent");
  assert.equal(getIntentSummaryCopy("buy"), "Mode: For sale");
  assert.equal(getIntentSummaryCopy("all"), "Mode: All homes");
});
