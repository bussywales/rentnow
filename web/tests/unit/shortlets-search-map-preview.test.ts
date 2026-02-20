import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const mapClientPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchMap.client.tsx"
);

void test("shortlets map preview exposes click-through CTA aligned to true bookability", () => {
  const contents = fs.readFileSync(mapClientPath, "utf8");

  assert.ok(contents.includes("resolveShortletsMapPreviewCtaLabel"));
  assert.ok(contents.includes("isShortletBookableFromPricing"));
  assert.ok(contents.includes("resolveShortletBookabilityCta"));
  assert.ok(contents.includes('data-testid="shortlets-map-preview-cta"'));
  assert.ok(contents.includes("href={selectedListing.href}"));
  assert.ok(contents.includes("mapPreviewImageUrl"));
  assert.ok(contents.includes("bookingMode: selectedListing.bookingMode"));
  assert.ok(contents.includes("pricingMode: selectedListing.pricingMode"));
  assert.equal(contents.includes("<img"), false);
});
