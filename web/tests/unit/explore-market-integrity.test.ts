import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { mockProperties } from "@/lib/mock";
import { filterExploreFeedByMarket } from "@/lib/explore/explore-feed.server";
import { resolveExploreListingMarketCountry } from "@/lib/explore/explore-presentation";

void test("filterExploreFeedByMarket returns only matching market listings when available", () => {
  const ngListing = {
    ...mockProperties[0],
    id: "ng-listing",
    country_code: "NG",
    country: "Nigeria",
  };
  const gbListing = {
    ...mockProperties[1],
    id: "gb-listing",
    country_code: "GB",
    country: "United Kingdom",
  };
  const feed = filterExploreFeedByMarket([ngListing, gbListing], "GB");

  assert.deepEqual(
    feed.map((listing) => listing.id),
    ["gb-listing"]
  );
});

void test("filterExploreFeedByMarket falls back to original feed when no listing matches", () => {
  const ngListing = {
    ...mockProperties[0],
    id: "ng-listing-fallback",
    country_code: "NG",
  };
  const feed = filterExploreFeedByMarket([ngListing], "US");

  assert.deepEqual(
    feed.map((listing) => listing.id),
    ["ng-listing-fallback"]
  );
});

void test("resolveExploreListingMarketCountry normalizes UK alias and falls back safely", () => {
  const withUkCode = {
    ...mockProperties[0],
    country_code: "UK",
  };
  assert.equal(resolveExploreListingMarketCountry(withUkCode, "NG"), "GB");

  const missingCountry = {
    ...mockProperties[0],
    country_code: null,
    country: null,
  };
  assert.equal(resolveExploreListingMarketCountry(missingCountry, "CA"), "CA");
});

void test("explore slide binds trust badge market to listing market resolver", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreSlide.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExploreListingMarketCountry/);
  assert.match(source, /marketCountry=\{listingMarketCountry\}/);
});
