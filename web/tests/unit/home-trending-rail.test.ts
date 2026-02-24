import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("tenant home keeps trending rail while host /home focuses on listings feed rails", () => {
  const hostHomePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const hostFeedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const tenantHomePath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const hostHome = fs.readFileSync(hostHomePath, "utf8");
  const hostFeed = fs.readFileSync(hostFeedPath, "utf8");
  const tenantHome = fs.readFileSync(tenantHomePath, "utf8");

  assert.match(tenantHome, /trendingHomes\.length > 0/);
  assert.match(tenantHome, /Trending this week/);
  assert.match(hostHome, /<WorkspaceHomeFeed[\s\S]*role=\{role\}/);
  assert.match(hostHome, /displayName=\{displayName\}/);
  assert.match(hostHome, /priorityLine=\{heroPriorityLine\}/);
  assert.match(hostFeed, /data-testid=\"home-featured-strip\"/);
  assert.match(hostFeed, /data-testid=\"home-for-you-grid\"/);
});
