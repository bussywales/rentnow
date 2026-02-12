import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("home pages render trending rail only when results exist", () => {
  const hostHomePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const tenantHomePath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const hostHome = fs.readFileSync(hostHomePath, "utf8");
  const tenantHome = fs.readFileSync(tenantHomePath, "utf8");

  assert.match(hostHome, /trendingHomes\.length > 0/);
  assert.match(tenantHome, /trendingHomes\.length > 0/);
  assert.match(hostHome, /Trending this week/);
  assert.match(tenantHome, /Trending this week/);
});

