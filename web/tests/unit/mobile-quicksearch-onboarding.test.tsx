import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("curated discovery surfaces wire featuredTap tracking through TrackViewedLink", () => {
  const files = [
    path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx"),
    path.join(process.cwd(), "components", "shortlets", "discovery", "ShortletsFeaturedRail.tsx"),
    path.join(process.cwd(), "components", "properties", "discovery", "PropertiesFeaturedRail.tsx"),
    path.join(process.cwd(), "components", "collections", "CollectionRail.tsx"),
  ];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.match(source, /featuredTap=\{/);
  }
});

void test("mobile quick search sheet includes onboarding suggestions and last-search CTA", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickSearchSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-quicksearch-empty-suggestions"/);
  assert.match(source, /data-testid="mobile-quicksearch-empty-suggestion"/);
  assert.match(source, /data-testid="mobile-quicksearch-use-last-search"/);
  assert.match(source, /Picks for \{marketCountry\}/);
});

void test("mobile saved and recently-viewed rails provide market-aware empty-state suggestions", () => {
  const savedRailPath = path.join(process.cwd(), "components", "home", "MobileSavedRail.tsx");
  const savedRail = fs.readFileSync(savedRailPath, "utf8");
  assert.match(savedRail, /mobile-saved-empty-suggestions/);
  assert.match(savedRail, /getMobileEmptyStateSuggestions/);
  assert.match(savedRail, /getMarketSearchTerminology/);

  const viewedRailPath = path.join(process.cwd(), "components", "home", "MobileRecentlyViewedRail.tsx");
  const viewedRail = fs.readFileSync(viewedRailPath, "utf8");
  assert.match(viewedRail, /mobile-recently-viewed-empty-suggestions/);
  assert.match(viewedRail, /getMobileEmptyStateSuggestions/);
  assert.match(viewedRail, /getMarketSearchTerminology/);
});
