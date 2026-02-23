import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("tenant home keeps trending rail while host /home focuses on listings feed rails", () => {
  const hostHomePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const tenantHomePath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const hostHome = fs.readFileSync(hostHomePath, "utf8");
  const tenantHome = fs.readFileSync(tenantHomePath, "utf8");

  assert.match(tenantHome, /trendingHomes\.length > 0/);
  assert.match(tenantHome, /Trending this week/);
  assert.match(hostHome, /sectionTestId=\"home-featured-strip\"/);
  assert.match(hostHome, /sectionTestId=\"home-rail-new-this-week\"/);
  assert.match(hostHome, /sectionTestId=\"home-rail-most-saved\"/);
  assert.match(hostHome, /sectionTestId=\"home-rail-most-viewed\"/);
  assert.match(hostHome, /data-testid=\"home-for-you-grid\"/);
});
