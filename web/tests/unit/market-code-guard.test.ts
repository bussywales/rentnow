import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVERY_CATALOGUE } from "@/lib/discovery/discovery-catalogue";
import { normalizeDiscoveryMarket } from "@/lib/discovery/market-taxonomy";
import { resolveCollectionsRegistry } from "@/lib/collections/collections-registry";

function assertNoLegacyUkTag(tags: readonly string[], context: string) {
  assert.equal(
    tags.includes("UK"),
    false,
    `${context} uses legacy market tag UK; use GB (alias remains supported at input boundary).`
  );
}

void test("market normalization keeps UK alias but canonicalizes to GB", () => {
  assert.equal(normalizeDiscoveryMarket("UK"), "GB");
  assert.equal(normalizeDiscoveryMarket("uk"), "GB");
  assert.equal(normalizeDiscoveryMarket("GB"), "GB");
});

void test("discovery static catalogue contains no UK market tags", () => {
  for (const item of DISCOVERY_CATALOGUE) {
    assertNoLegacyUkTag(item.marketTags, `discovery item ${item.id}`);
  }
});

void test("collections static registry contains no UK market tags", () => {
  const collections = resolveCollectionsRegistry(new Date("2026-02-26T00:00:00.000Z"));
  for (const item of collections) {
    assertNoLegacyUkTag(item.marketTags, `collection ${item.slug}`);
  }
});
