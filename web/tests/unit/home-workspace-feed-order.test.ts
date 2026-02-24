import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace home keeps visual feed ahead of technical sections", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const pageSource = fs.readFileSync(pagePath, "utf8");
  const feedSource = fs.readFileSync(feedPath, "utf8");

  const feedMountIndex = pageSource.indexOf("<WorkspaceHomeFeed");
  const toolsIndex = pageSource.indexOf('testId="home-workspace-tools"');
  const checklistIndex = pageSource.indexOf('testId="home-getting-started"');

  assert.ok(feedMountIndex >= 0, "expected workspace feed mount in /home");
  assert.ok(toolsIndex >= 0, "expected tools section");
  assert.ok(checklistIndex >= 0, "expected checklist section");
  assert.ok(feedMountIndex < toolsIndex, "expected feed above workspace tools");
  assert.ok(feedMountIndex < checklistIndex, "expected feed above checklist");

  assert.match(feedSource, /data-testid=\"home-featured-strip\"/);
  assert.match(feedSource, /data-testid=\"home-for-you-grid\"/);
  assert.match(feedSource, /home-feed-cta-create-listing/);
});
