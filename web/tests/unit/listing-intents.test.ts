import { test } from "node:test";
import assert from "node:assert/strict";
import { getHostListingIntentOptions, getPublicListingIntentLabel } from "@/lib/listing-intents";

void test("host listing intent labels use Rent/Lease and Sell (For Sale)", () => {
  const options = getHostListingIntentOptions();
  const rent = options.find((opt) => opt.value === "rent");
  const buy = options.find((opt) => opt.value === "buy");
  assert.equal(rent?.label, "Rent/Lease");
  assert.equal(buy?.label, "Sell (For Sale)");
});

void test("public listing intent labels remain Rent/Buy", () => {
  assert.equal(getPublicListingIntentLabel("rent"), "Rent");
  assert.equal(getPublicListingIntentLabel("buy"), "Buy");
});
