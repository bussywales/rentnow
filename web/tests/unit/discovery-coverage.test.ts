import test from "node:test";
import assert from "node:assert/strict";
import type { DiscoveryCatalogueItem } from "@/lib/discovery";
import type { StaticCollectionDefinition } from "@/lib/collections/collections-registry";
import { computeDiscoveryCoverageSummary } from "@/lib/discovery/diagnostics/coverage";

function makeDiscoveryItem(overrides: Partial<DiscoveryCatalogueItem>): DiscoveryCatalogueItem {
  return {
    id: "base-item",
    title: "Base item",
    kind: "shortlet",
    intent: "shortlet",
    marketTags: ["GLOBAL"],
    params: { where: "Lagos" },
    priority: 50,
    surfaces: ["HOME_FEATURED"],
    ...overrides,
  };
}

function makeCollection(overrides: Partial<StaticCollectionDefinition>): StaticCollectionDefinition {
  return {
    slug: "weekend-getaways",
    title: "Weekend getaways",
    description: "Shortlet picks.",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "2" },
    ...overrides,
  };
}

void test("coverage summary computes counts by market and surface", () => {
  const discoveryItems: DiscoveryCatalogueItem[] = [
    makeDiscoveryItem({
      id: "global-home",
      marketTags: ["GLOBAL"],
      surfaces: ["HOME_FEATURED"],
    }),
    makeDiscoveryItem({
      id: "ng-home",
      marketTags: ["NG"],
      surfaces: ["HOME_FEATURED"],
    }),
    makeDiscoveryItem({
      id: "ca-properties",
      kind: "property",
      intent: "rent",
      marketTags: ["CA"],
      params: { category: "rent", intent: "rent" },
      surfaces: ["PROPERTIES_FEATURED"],
    }),
  ];
  const collectionsItems: StaticCollectionDefinition[] = [makeCollection({ slug: "family-friendly-stays" })];

  const summary = computeDiscoveryCoverageSummary({
    discoveryItems,
    collectionsItems,
  });

  const ngHome = summary.rows.find((row) => row.market === "NG" && row.surface === "HOME_FEATURED");
  assert.ok(ngHome);
  assert.equal(ngHome.availableCount, 2);
  assert.equal(ngHome.marketSpecificCount, 1);
  assert.equal(ngHome.atRisk, true);

  const caProperties = summary.rows.find(
    (row) => row.market === "CA" && row.surface === "PROPERTIES_FEATURED"
  );
  assert.ok(caProperties);
  assert.equal(caProperties.availableCount, 1);
  assert.equal(caProperties.marketSpecificCount, 1);

  const globalCollections = summary.rows.find(
    (row) => row.market === "GLOBAL" && row.surface === "COLLECTIONS"
  );
  assert.ok(globalCollections);
  assert.equal(globalCollections.availableCount, 1);
  assert.equal(globalCollections.marketSpecificCount, 0);
});

void test("top risks are sorted by deficit then market-specific depth", () => {
  const summary = computeDiscoveryCoverageSummary({
    discoveryItems: [
      makeDiscoveryItem({
        id: "single-global",
        marketTags: ["GLOBAL"],
        surfaces: ["HOME_FEATURED"],
      }),
    ],
    collectionsItems: [],
  });

  assert.ok(summary.topRisks.length > 0);
  for (let index = 1; index < summary.topRisks.length; index += 1) {
    const previous = summary.topRisks[index - 1];
    const current = summary.topRisks[index];
    assert.ok(previous.deficit >= current.deficit);
  }
});
