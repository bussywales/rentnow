import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("public home computes featured rail fallback from popular/new listings", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /const featuredRailMode = featured\.length/);
  assert.match(source, /const featuredRailListings =/);
  assert.match(source, /featuredRailMode === "popular"/);
  assert.match(source, /featuredRailMode === "new"/);
  assert.match(source, /home_mobile_featured_fallback_\$\{featuredRailMode\}/);
  assert.match(source, /featuredRailListings\.length \? \(/);
  assert.match(source, /sectionTestId="mobile-home-featured-rail"/);
});

void test("public home no longer fetches featured rails through external API base URL", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.ok(!source.includes("featuredApiUrl"), "expected external featuredApiUrl fetch removed");
  assert.ok(!source.includes("getApiBaseUrl"), "expected home page to avoid getApiBaseUrl for listing rails");
  assert.match(source, /searchProperties\(baseFilters, \{ page: 1, pageSize: 10, featuredOnly: true \}\)/);
  assert.match(source, /recentDays: 7/);
});
