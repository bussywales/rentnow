import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listings grid uses stable skeleton and hover/focus CTA reveal", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /resolveStableListingImageSrc/);
  assert.match(source, /key=\{`listing-image-\$\{listing\.id\}`\}/);
  assert.doesNotMatch(source, /animate-pulse/);
  assert.match(source, /max-h-\[60vh\]/);
  assert.match(source, /getHostListingTileAspectClass/);
  assert.match(source, /hover:shadow-md/);
  assert.match(source, /group-hover:scale-\[1\.01\]/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /data-testid=\"host-home-listings-grid\"/);
});
