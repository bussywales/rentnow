import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPropertiesCategoryParams,
  getPropertiesCategoryContext,
  resolvePropertiesBrowseCategory,
} from "@/lib/properties/browse-categories";

test("resolvePropertiesBrowseCategory prioritizes explicit category param", () => {
  const category = resolvePropertiesBrowseCategory({
    categoryParam: "off_plan",
    intentParam: "rent",
    stayParam: "shortlet",
    listingIntentParam: "shortlet",
  });
  assert.equal(category, "off_plan");
});

test("resolvePropertiesBrowseCategory maps existing stay and intent params", () => {
  assert.equal(
    resolvePropertiesBrowseCategory({
      categoryParam: null,
      intentParam: "buy",
      stayParam: null,
      listingIntentParam: null,
      fallbackIntent: "rent",
    }),
    "buy"
  );
  assert.equal(
    resolvePropertiesBrowseCategory({
      categoryParam: null,
      intentParam: "all",
      stayParam: "shortlet",
      listingIntentParam: null,
      fallbackIntent: "all",
    }),
    "shortlet"
  );
});

test("buildPropertiesCategoryParams preserves compatible filters and clears conflicts", () => {
  const base = new URLSearchParams(
    "city=Lagos&bedrooms=2&rentalType=short_let&stay=shortlet&intent=rent&page=3"
  );
  const next = buildPropertiesCategoryParams(base, "buy");

  assert.equal(next.get("category"), "buy");
  assert.equal(next.get("intent"), "buy");
  assert.equal(next.get("stay"), null);
  assert.equal(next.get("listingIntent"), null);
  assert.equal(next.get("rentalType"), null);
  assert.equal(next.get("city"), "Lagos");
  assert.equal(next.get("bedrooms"), "2");
  assert.equal(next.get("page"), "1");
});

test("off-plan category sets exact listing intent", () => {
  const context = getPropertiesCategoryContext("off_plan");
  assert.equal(context.listingIntent, "buy");
  assert.equal(context.stay, null);
  assert.equal(context.exactListingIntent, "off_plan");

  const next = buildPropertiesCategoryParams(new URLSearchParams("city=Abuja"), "off_plan");
  assert.equal(next.get("intent"), "buy");
  assert.equal(next.get("listingIntent"), "off_plan");
  assert.equal(next.get("city"), "Abuja");
});
