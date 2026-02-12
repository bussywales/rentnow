import test from "node:test";
import assert from "node:assert/strict";

import {
  formatLocationLabel,
  formatPriceLabel,
  formatPriceValue,
  getBrowseEmptyStateCtas,
} from "../../lib/property-discovery";

void test("formatLocationLabel prefers neighbourhood then city", () => {
  assert.equal(formatLocationLabel("Lagos", "Lekki"), "Lekki, Lagos");
  assert.equal(formatLocationLabel("Accra", null), "Accra");
  assert.equal(formatLocationLabel("", "Ikoyi"), "Ikoyi");
});

void test("formatPriceLabel formats price with cadence", () => {
  assert.equal(formatPriceValue("NGN", 125000), "\u20a6125,000");
  assert.equal(formatPriceValue("GBP", 1250), "\u00a31,250");
  assert.equal(formatPriceValue("USD", 1200), "USD 1,200");
  assert.equal(formatPriceValue(null, 1200, { marketCurrency: "GBP" }), "\u00a31,200");
  assert.equal(formatPriceValue(undefined, 1200), "\u20a61,200");
  assert.equal(
    formatPriceValue("USD", 1200, { marketCurrency: "GBP" }),
    "USD 1,200"
  );
  assert.equal(formatPriceLabel("USD", 1200, "short_let"), "USD 1,200 / night");
  assert.equal(
    formatPriceLabel("USD", 1200, "long_term", "monthly"),
    "USD 1,200 / month"
  );
  assert.equal(
    formatPriceLabel("USD", 1200, "long_term", "yearly"),
    "USD 1,200 / year"
  );
});

void test("empty state CTAs include saved searches for tenants", () => {
  const tenantCtas = getBrowseEmptyStateCtas({ role: "tenant", hasFilters: true });
  assert.deepEqual(
    tenantCtas.map((cta) => cta.label),
    ["Clear filters", "Browse all", "Saved searches"]
  );

  const landlordCtas = getBrowseEmptyStateCtas({ role: "landlord", hasFilters: true });
  assert.deepEqual(
    landlordCtas.map((cta) => cta.label),
    ["Clear filters", "Browse all", "Saved searches"]
  );
});
