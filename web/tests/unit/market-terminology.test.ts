import test from "node:test";
import assert from "node:assert/strict";
import { getMarketSearchTerminology } from "@/lib/market/terminology";

test("market terminology maps GB/US/CA/NG copy correctly", () => {
  assert.equal(getMarketSearchTerminology("GB").locationFieldLabel, "Location or postcode");
  assert.equal(getMarketSearchTerminology("US").locationFieldLabel, "Location or ZIP code");
  assert.equal(getMarketSearchTerminology("CA").locationFieldLabel, "Location or postal code");
  assert.equal(getMarketSearchTerminology("NG").locationFieldLabel, "Location or area");
});

test("market terminology falls back safely for unknown markets", () => {
  const fallback = getMarketSearchTerminology("ZZ");
  assert.equal(fallback.locationFieldLabel, "Location");
  assert.equal(fallback.homeTypeNoun, "homes");
});
