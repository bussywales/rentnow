import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendedNextItems } from "@/lib/reco";
import type { DiscoveryCatalogueItem } from "@/lib/discovery";

const FIXTURE_ITEMS: DiscoveryCatalogueItem[] = [
  {
    id: "global-shortlet-flex",
    title: "Global shortlet flex",
    subtitle: "Global fallback shortlet",
    kind: "shortlet",
    intent: "shortlet",
    marketTags: ["GLOBAL"],
    params: { where: "Global City", guests: "2" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "global-rent-core",
    title: "Global rent core",
    subtitle: "Global fallback rent",
    kind: "property",
    intent: "rent",
    marketTags: ["GLOBAL"],
    params: { category: "rent", intent: "rent", city: "Global Town" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "ca-rent-toronto",
    title: "CA rent Toronto",
    subtitle: "Rent picks Toronto",
    kind: "property",
    intent: "rent",
    marketTags: ["CA"],
    params: { category: "rent", intent: "rent", city: "Toronto" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "ca-buy-calgary",
    title: "CA buy Calgary",
    subtitle: "Buy picks Calgary",
    kind: "property",
    intent: "buy",
    marketTags: ["CA"],
    params: { category: "buy", intent: "buy", city: "Calgary" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "ca-offplan-montreal",
    title: "CA off-plan Montreal",
    subtitle: "Off-plan Montreal",
    kind: "property",
    intent: "buy",
    marketTags: ["CA"],
    params: { category: "off_plan", intent: "off_plan", city: "Montreal" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "ca-shortlet-vancouver",
    title: "CA shortlet Vancouver",
    subtitle: "Shortlet Vancouver",
    kind: "shortlet",
    intent: "shortlet",
    marketTags: ["CA"],
    params: { where: "Vancouver", guests: "2" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
  {
    id: "ng-rent-lagos",
    title: "NG rent Lagos",
    subtitle: "Rent picks Lagos",
    kind: "property",
    intent: "rent",
    marketTags: ["NG"],
    params: { category: "rent", intent: "rent", city: "Lagos" },
    priority: 60,
    surfaces: ["HOME_FEATURED"],
  },
];

void test("recommendations fall back to market-safe catalogue when no local signals exist", () => {
  const results = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 4,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-no-signals",
    items: FIXTURE_ITEMS,
  });

  assert.equal(results.length, 4);
  assert.ok(results.every((item) => item.reason === "Popular in your market"));
  assert.ok(results.every((item) => item.id !== "ng-rent-lagos"));
});

void test("recommendations exclude exact saved and viewed IDs", () => {
  const results = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 5,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-exclusion",
    items: FIXTURE_ITEMS,
    savedItems: [
      {
        id: "ca-rent-toronto",
        kind: "property",
        href: "/properties?intent=rent&city=Toronto",
      },
    ],
    viewedItems: [
      {
        id: "ca-shortlet-vancouver",
        kind: "shortlet",
        href: "/shortlets?where=Vancouver",
      },
    ],
  });

  assert.ok(!results.some((item) => item.id === "ca-rent-toronto"));
  assert.ok(!results.some((item) => item.id === "ca-shortlet-vancouver"));
  assert.ok(results.some((item) => item.reason === "Based on your saved" || item.reason === "Because you viewed"));
});

void test("recommendations align to last browse intent and kind when available", () => {
  const results = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 4,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-last-browse",
    items: FIXTURE_ITEMS,
    lastBrowseHref: "/properties?intent=rent&city=Toronto",
  });

  assert.equal(results[0]?.kind, "property");
  assert.equal(results[0]?.reason, "Continue browsing");
});

void test("unknown markets use GLOBAL fallback entries only", () => {
  const results = buildRecommendedNextItems({
    marketCountry: "ZZ",
    limit: 3,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-global-fallback",
    items: FIXTURE_ITEMS,
  });

  assert.ok(results.length >= 2);
  const ids = results.map((item) => item.id);
  assert.ok(ids.includes("global-shortlet-flex"));
  assert.ok(ids.includes("global-rent-core"));
  assert.ok(!ids.includes("ca-rent-toronto"));
  assert.ok(!ids.includes("ng-rent-lagos"));
});

void test("ordering is deterministic for same seed and rotates across days", () => {
  const first = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 5,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-stable-seed",
    items: FIXTURE_ITEMS,
  }).map((item) => item.id);

  const second = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 5,
    now: new Date("2026-02-26T00:00:00.000Z"),
    seedBucket: "unit-stable-seed",
    items: FIXTURE_ITEMS,
  }).map((item) => item.id);

  const nextDay = buildRecommendedNextItems({
    marketCountry: "CA",
    limit: 5,
    now: new Date("2026-02-27T00:00:00.000Z"),
    seedBucket: "unit-stable-seed",
    items: FIXTURE_ITEMS,
  }).map((item) => item.id);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, nextDay);
  assert.equal(new Set(first).size, first.length);
});
