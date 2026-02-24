import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page includes unified category row", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /data-testid="properties-category-row"/);
  assert.match(source, /To rent/);
  assert.match(source, /For sale/);
  assert.match(source, /Short-lets/);
  assert.match(source, /Off-plan/);
  assert.match(source, /All homes/);
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
