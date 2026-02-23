import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listings mosaic grid uses responsive editorial columns", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /grid-cols-1 gap-3\.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3/);
  assert.match(source, /All listings/);
  assert.match(source, /Portfolio mosaic/);
});

void test("host listings mosaic tiles enforce aspect rhythm and max media height", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /getHostListingTileAspectClass\(pattern\)/);
  assert.match(source, /max-h-\[60vh\]/);
  assert.match(source, /object-cover/);
  assert.match(source, /HostListingActionsMenu/);
  assert.match(source, /Manage/);
});

void test("host listings mosaic uses branded placeholder tile when listing has no photo", () => {
  const gridPath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const gridSource = fs.readFileSync(gridPath, "utf8");
  const placeholderPath = path.join(process.cwd(), "components", "ui", "ListingImagePlaceholder.tsx");
  const placeholderSource = fs.readFileSync(placeholderPath, "utf8");

  assert.match(gridSource, /<ListingImagePlaceholder\s*\/>/);
  assert.match(placeholderSource, /No photo yet/);
  assert.match(placeholderSource, /bg-gradient-to-br/);
});
