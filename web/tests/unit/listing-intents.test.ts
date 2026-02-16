import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getHostListingIntentOptions,
  mapIntentForSearchFilter,
  mapSearchFilterToListingIntents,
  getPublicListingIntentLabel,
  normalizeListingIntent,
} from "@/lib/listing-intents";

void test("host listing intent options include expanded intents", () => {
  const options = getHostListingIntentOptions();
  const rent = options.find((opt) => opt.value === "rent_lease");
  const buy = options.find((opt) => opt.value === "sale");
  const shortlet = options.find((opt) => opt.value === "shortlet");
  const offPlan = options.find((opt) => opt.value === "off_plan");
  assert.equal(rent?.label, "Rent/Lease");
  assert.equal(buy?.label, "Sell (For sale)");
  assert.equal(shortlet?.label, "Shortlet (Bookable stay)");
  assert.equal(offPlan?.label, "Off-plan");
});

void test("public listing intent labels support legacy and canonical values", () => {
  assert.equal(getPublicListingIntentLabel("rent_lease"), "Rent/Lease");
  assert.equal(getPublicListingIntentLabel("sale"), "For sale");
  assert.equal(getPublicListingIntentLabel("shortlet"), "Shortlet");
  assert.equal(getPublicListingIntentLabel("off_plan"), "Off-plan");
  assert.equal(getPublicListingIntentLabel("rent"), "Rent/Lease");
  assert.equal(getPublicListingIntentLabel("buy"), "For sale");
});

void test("normalizeListingIntent maps legacy rent/buy to canonical values", () => {
  assert.equal(normalizeListingIntent("rent"), "rent_lease");
  assert.equal(normalizeListingIntent("buy"), "sale");
  assert.equal(normalizeListingIntent("shortlet"), "shortlet");
  assert.equal(normalizeListingIntent("off_plan"), "off_plan");
});

void test("browse intent mapping keeps shortlet under rent and off-plan under buy", () => {
  assert.equal(mapIntentForSearchFilter("shortlet"), "rent");
  assert.equal(mapIntentForSearchFilter("off_plan"), "buy");
  assert.deepEqual(mapSearchFilterToListingIntents("rent"), ["rent_lease", "rent", "shortlet"]);
  assert.deepEqual(mapSearchFilterToListingIntents("buy"), ["sale", "buy", "off_plan"]);
});
