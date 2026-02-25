import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDiscoveryMarket,
  selectDiscoveryItems,
} from "@/lib/discovery";

const FIXED_DATE = new Date("2026-02-25T00:00:00.000Z");

void test("market normalization maps GB to UK and unknown to GLOBAL", () => {
  assert.equal(normalizeDiscoveryMarket("GB"), "UK");
  assert.equal(normalizeDiscoveryMarket("uk"), "UK");
  assert.equal(normalizeDiscoveryMarket("US"), "US");
  assert.equal(normalizeDiscoveryMarket("ZZ"), "GLOBAL");
});

void test("selection for known market returns market items first with no duplicates", () => {
  const selected = selectDiscoveryItems({
    market: "UK",
    surface: "HOME_FEATURED",
    limit: 4,
    seedDate: FIXED_DATE,
    seedBucket: "unit",
  });

  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((item) => item.id)).size, 4);
  assert.ok(selected.every((item) => item.marketTags.includes("UK")));
});

void test("selection supports US market and falls back to GLOBAL only when needed", () => {
  const selected = selectDiscoveryItems({
    market: "US",
    surface: "HOME_FEATURED",
    limit: 6,
    seedDate: FIXED_DATE,
    seedBucket: "unit",
  });

  assert.equal(selected.length, 6);
  assert.ok(
    selected.every((item) => item.marketTags.includes("US") || item.marketTags.includes("GLOBAL"))
  );
  assert.equal(
    selected.some((item) => item.marketTags.includes("NG") && !item.marketTags.includes("GLOBAL")),
    false
  );
});

void test("unknown market returns GLOBAL-only discovery set", () => {
  const selected = selectDiscoveryItems({
    market: "ZZ",
    surface: "HOME_FEATURED",
    limit: 4,
    seedDate: FIXED_DATE,
    seedBucket: "unit",
  });

  assert.equal(selected.length, 4);
  assert.ok(selected.every((item) => item.marketTags.includes("GLOBAL")));
});

void test("selection is deterministic for same seed and rotates across dates", () => {
  const first = selectDiscoveryItems({
    market: "CA",
    surface: "HOME_FEATURED",
    limit: 6,
    seedDate: new Date("2026-02-25T00:00:00.000Z"),
    seedBucket: "unit",
  }).map((item) => item.id);
  const repeat = selectDiscoveryItems({
    market: "CA",
    surface: "HOME_FEATURED",
    limit: 6,
    seedDate: new Date("2026-02-25T00:00:00.000Z"),
    seedBucket: "unit",
  }).map((item) => item.id);
  const nextDay = selectDiscoveryItems({
    market: "CA",
    surface: "HOME_FEATURED",
    limit: 6,
    seedDate: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit",
  }).map((item) => item.id);

  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, nextDay);
});
