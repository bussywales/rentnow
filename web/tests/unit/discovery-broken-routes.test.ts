import test from "node:test";
import assert from "node:assert/strict";
import type { DiscoveryCatalogueItem } from "@/lib/discovery";
import type { StaticCollectionDefinition } from "@/lib/collections/collections-registry";
import { auditDiscoveryBrokenRoutes } from "@/lib/discovery/diagnostics/broken-routes";

function makeDiscoveryItem(overrides: Partial<DiscoveryCatalogueItem>): DiscoveryCatalogueItem {
  return {
    id: "base",
    title: "Base item",
    kind: "shortlet",
    intent: "shortlet",
    marketTags: ["GLOBAL"],
    params: { where: "Lagos", guests: "2" },
    priority: 50,
    surfaces: ["HOME_FEATURED"],
    ...overrides,
  };
}

function makeCollection(overrides: Partial<StaticCollectionDefinition>): StaticCollectionDefinition {
  return {
    slug: "weekend-getaways",
    title: "Weekend getaways",
    description: "Base collection",
    surface: "SHORTLETS_FEATURED",
    primaryKind: "shortlet",
    intent: "shortlet",
    marketTags: ["ALL"],
    params: { guests: "2" },
    ...overrides,
  };
}

void test("broken route audit flags invalid query formats and missing required params", () => {
  const issues = auditDiscoveryBrokenRoutes({
    discoveryItems: [
      makeDiscoveryItem({
        id: "invalid-guests",
        params: { where: "Lagos", guests: "abc", checkIn: "2026-03-02" },
      }),
    ],
    collectionsItems: [makeCollection({ slug: "family-friendly-stays" })],
    now: new Date("2026-02-26T00:00:00.000Z"),
  });

  assert.ok(issues.some((issue) => issue.reasonCode === "INVALID_QUERY_PARAM_FORMAT"));
  assert.ok(issues.some((issue) => issue.reasonCode === "MISSING_REQUIRED_PARAM"));
});

void test("broken route audit flags unknown collection slug references", () => {
  const issues = auditDiscoveryBrokenRoutes({
    discoveryItems: [
      makeDiscoveryItem({
        id: "unknown-collection-ref",
        kind: "property",
        intent: "rent",
        params: { category: "rent", intent: "rent", collectionSlug: "unknown-collection" },
      }),
    ],
    collectionsItems: [makeCollection({ slug: "weekend-getaways" })],
    now: new Date("2026-02-26T00:00:00.000Z"),
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.reasonCode === "UNKNOWN_COLLECTION_SLUG" &&
        issue.routeLabel === "collection_reference"
    )
  );
});
