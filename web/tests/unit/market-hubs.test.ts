import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketHubHref, getMarketHubs } from "@/lib/market/hubs";

void test("market hubs return Nigeria defaults for NG", () => {
  const hubs = getMarketHubs("NG");
  assert.deepEqual(
    hubs.map((hub) => hub.label),
    ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu"]
  );
});

void test("market hubs return UK defaults for GB", () => {
  const hubs = getMarketHubs("GB");
  assert.deepEqual(
    hubs.map((hub) => hub.label),
    ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"]
  );
});

void test("hub link builder creates stable properties query links", () => {
  const hub = getMarketHubs("NG")[0];
  assert.ok(hub);
  assert.equal(buildMarketHubHref(hub), "/properties?city=Lagos");
});
