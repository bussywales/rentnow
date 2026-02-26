import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile recommended next rail source keeps stable hooks and testids", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileRecommendedNextRail.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="recommended-next-rail"/);
  assert.match(source, /data-testid="recommended-next-scroll"/);
  assert.match(source, /data-testid="recommended-next-item"/);
  assert.match(source, /data-testid="recommended-next-reason"/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label=\{`Recommended next for \$\{market\.country\}`\}/);
  assert.match(source, /getSavedItems/);
  assert.match(source, /getViewedItems/);
  assert.match(source, /getLastBrowseUrl/);
  assert.match(source, /getLastSearchHref/);
  assert.match(source, /buildRecommendedNextItems/);
  assert.match(source, /subscribeSavedItems/);
  assert.match(source, /subscribeViewedItems/);
  assert.match(source, /subscribeLastBrowseUrl/);
});

void test("home page mounts mobile recommended rail after saved and before listing rails", () => {
  const sourcePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /import\s+\{\s*MobileRecommendedNextRail\s*\}\s+from\s+"@\/components\/home\/MobileRecommendedNextRail"/
  );
  assert.match(source, /<MobileRecommendedNextRail \/>/);
  assert.ok(source.indexOf("<MobileSavedRail />") < source.indexOf("<MobileRecommendedNextRail />"));
  assert.ok(source.indexOf("<MobileRecommendedNextRail />") < source.indexOf("<HomeListingRail"));
});
