import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIntentHref,
  getIntentModeHint,
  getIntentRecoveryOptions,
  LISTING_INTENT_TOGGLE_OPTIONS,
} from "@/lib/properties/listing-intent-ui";

test("listing intent toggle options use browse copy", () => {
  assert.deepEqual(
    LISTING_INTENT_TOGGLE_OPTIONS.map((option) => option.label),
    ["To rent", "For sale", "All"]
  );
});

test("intent mode hint copy appears only for filtered modes", () => {
  assert.equal(
    getIntentModeHint("rent"),
    "Showing rentals - switch to All to include for-sale homes."
  );
  assert.equal(
    getIntentModeHint("buy"),
    "Showing for-sale homes - switch to All to include rentals."
  );
  assert.equal(getIntentModeHint("all"), null);
});

test("intent recovery options and links preserve existing filters", () => {
  assert.deepEqual(getIntentRecoveryOptions("rent"), [
    { intent: "all", label: "Try All" },
    { intent: "buy", label: "Try For sale" },
  ]);
  assert.deepEqual(getIntentRecoveryOptions("buy"), [
    { intent: "all", label: "Try All" },
    { intent: "rent", label: "Try To rent" },
  ]);
  assert.deepEqual(getIntentRecoveryOptions("all"), []);

  const params = new URLSearchParams("city=Lagos&bedrooms=4&intent=buy&source=saved-search");
  const href = buildIntentHref("/properties", params, "all");
  assert.equal(href, "/properties?city=Lagos&bedrooms=4&intent=all&source=saved-search");
});
