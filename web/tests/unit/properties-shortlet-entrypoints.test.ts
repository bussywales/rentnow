import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page includes shortlet stay toggle", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /const showStayTypeToggle = resolvedIntent !== "buy";/);
  assert.match(source, /stay: isShortletStayOnly \? null : "shortlet"/);
  assert.match(source, /intent: isShortletStayOnly \? resolvedIntent : "rent"/);
  assert.match(source, /Shortlets are bookable nightly stays \(rent only\)\./);
});

void test("smart search keeps stay=shortlet when browsing", () => {
  const searchPath = path.join(process.cwd(), "components", "properties", "SmartSearchBox.tsx");
  const source = fs.readFileSync(searchPath, "utf8");
  assert.match(source, /currentStay === "shortlet"/);
  assert.match(source, /normalizeIntentStaySelection/);
  assert.match(source, /next\.set\("intent", normalizedSelection\.listingIntent\)/);
});

void test("intent toggle clears stay filter outside rent mode", () => {
  const togglePath = path.join(process.cwd(), "components", "properties", "ListingIntentToggle.tsx");
  const source = fs.readFileSync(togglePath, "utf8");
  assert.match(source, /if \(intent !== "rent"\)/);
  assert.match(source, /next\.delete\("stay"\)/);
});
