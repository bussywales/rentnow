import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FILES_TO_CHECK = [
  path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx"),
  path.join(process.cwd(), "components", "shortlets", "discovery", "ShortletsFeaturedRail.tsx"),
  path.join(process.cwd(), "components", "properties", "discovery", "PropertiesFeaturedRail.tsx"),
  path.join(process.cwd(), "components", "collections", "CollectionRail.tsx"),
  path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchListCard.tsx"),
];

void test("primary discovery surfaces route through TrackViewedLink", () => {
  for (const filePath of FILES_TO_CHECK) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.match(
      source,
      /TrackViewedLink/,
      `expected ${path.basename(filePath)} to use TrackViewedLink`
    );
    assert.match(source, /viewedItem=\{/, `expected ${path.basename(filePath)} to provide viewed payload`);
  }
});

void test("property card captures listing-link clicks into viewed store", () => {
  const sourcePath = path.join(process.cwd(), "components", "properties", "PropertyCard.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /onClickCapture/);
  assert.match(source, /pushViewedItem/);
  assert.match(source, /shouldTrackPropertyViewHref/);
});
