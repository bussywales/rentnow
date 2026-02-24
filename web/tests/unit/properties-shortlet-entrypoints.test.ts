import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page includes unified category row", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  const helperPath = path.join(process.cwd(), "lib", "properties", "browse-categories.ts");
  const helperSource = fs.readFileSync(helperPath, "utf8");
  assert.match(source, /data-testid="properties-category-row"/);
  assert.match(source, /PROPERTIES_BROWSE_CATEGORY_OPTIONS\.map/);
  assert.match(source, /data-testid={`properties-category-\$\{option\.value\}`}/);
  assert.match(helperSource, /label: "To rent"/);
  assert.match(helperSource, /label: "For sale"/);
  assert.match(helperSource, /label: "Short-lets"/);
  assert.match(helperSource, /label: "Off-plan"/);
  assert.match(helperSource, /label: "All homes"/);
  assert.doesNotMatch(source, /Need a nightly stay\?/);
  assert.doesNotMatch(source, /Shortlets are bookable nightly stays/);
});

void test("smart search keeps stay=shortlet when browsing", () => {
  const searchPath = path.join(process.cwd(), "components", "properties", "SmartSearchBox.tsx");
  const source = fs.readFileSync(searchPath, "utf8");
  assert.match(source, /currentStay === "shortlet"/);
  assert.match(source, /normalizeIntentStaySelection/);
  assert.match(source, /next\.set\("intent", normalizedSelection\.listingIntent\)/);
});

void test("category helper clears conflicting params for non-rent categories", () => {
  const helperPath = path.join(process.cwd(), "lib", "properties", "browse-categories.ts");
  const source = fs.readFileSync(helperPath, "utf8");
  assert.match(source, /if \(category !== "rent"\)/);
  assert.match(source, /next\.delete\("rentalType"\)/);
  assert.match(source, /next\.delete\("stay"\)/);
});
