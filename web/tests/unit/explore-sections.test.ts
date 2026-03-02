import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import { buildExploreSectionedFeed, flattenExploreSectionedFeed } from "@/lib/explore/explore-feed.server";

function buildListing(id: string, marketCode: "NG" | "GB" | "CA" | "US") {
  return {
    ...mockProperties[0],
    id,
    country_code: marketCode,
    country:
      marketCode === "NG"
        ? "Nigeria"
        : marketCode === "GB"
          ? "United Kingdom"
          : marketCode === "CA"
            ? "Canada"
            : "United States",
  };
}

void test("buildExploreSectionedFeed keeps market picks in active market only", () => {
  const listings = [
    buildListing("ng-a", "NG"),
    buildListing("gb-a", "GB"),
    buildListing("ng-b", "NG"),
    buildListing("us-a", "US"),
  ];

  const sectioned = buildExploreSectionedFeed(listings, { marketCountry: "NG", limit: 20 });

  assert.deepEqual(
    sectioned.marketPicks.map((listing) => listing.id),
    ["ng-a", "ng-b"]
  );
  assert.ok(sectioned.moreToExplore.every((listing) => listing.country_code !== "NG"));
});

void test("buildExploreSectionedFeed fills fallback pool up to minimum when market supply is low", () => {
  const marketPicks = Array.from({ length: 5 }, (_, index) => buildListing(`ng-${index}`, "NG"));
  const fallback = Array.from({ length: 10 }, (_, index) => buildListing(`gb-${index}`, "GB"));
  const sectioned = buildExploreSectionedFeed([...marketPicks, ...fallback], {
    marketCountry: "NG",
    limit: 20,
  });

  assert.equal(sectioned.marketPicks.length, 5);
  assert.equal(sectioned.moreToExplore.length, 7);
  assert.equal(sectioned.meta.total, 12);
  assert.equal(sectioned.meta.appliedFallback, true);
  assert.equal(sectioned.meta.limitedResults, false);
});

void test("buildExploreSectionedFeed dedupes listing ids across sections and keeps deterministic order", () => {
  const listings = [
    buildListing("ng-a", "NG"),
    buildListing("ng-a", "NG"),
    buildListing("gb-a", "GB"),
    buildListing("gb-a", "GB"),
    buildListing("ng-b", "NG"),
  ];
  const sectioned = buildExploreSectionedFeed(listings, { marketCountry: "NG", limit: 20 });
  const flattened = flattenExploreSectionedFeed(sectioned);

  assert.deepEqual(
    flattened.map((listing) => listing.id),
    ["ng-a", "ng-b", "gb-a"]
  );
  assert.equal(new Set(flattened.map((listing) => listing.id)).size, flattened.length);
});

void test("buildExploreSectionedFeed marks limited results when minimum cannot be reached", () => {
  const listings = [buildListing("ng-a", "NG"), buildListing("gb-a", "GB"), buildListing("ca-a", "CA")];
  const sectioned = buildExploreSectionedFeed(listings, { marketCountry: "NG", limit: 20 });

  assert.equal(flattenExploreSectionedFeed(sectioned).length, 3);
  assert.equal(sectioned.meta.appliedFallback, true);
  assert.equal(sectioned.meta.limitedResults, true);
});
